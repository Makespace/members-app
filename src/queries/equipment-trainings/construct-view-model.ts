import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {UUID} from 'io-ts-types';
import {StatusCodes} from 'http-status-codes';
import {
  failureWithStatus,
  FailureWithStatus,
} from '../../types/failure-with-status';
import {Actor, User} from '../../types';
import {Dependencies} from '../../dependencies';
import {Equipment} from '../../read-models/shared-state/return-types';
import {getFullQuizResultsForEquipment} from '../../read-models/external-state/equipment-quiz';
import {isEquipmentTrainer} from '../../commands/authentication-helpers/is-equipment-trainer';
import {isEquipmentOwner} from '../../commands/authentication-helpers/is-equipment-owner';
import {isAdminOrSuperUser} from '../../commands/authentication-helpers/is-admin-or-super-user';
import {
  TrainingSessionView,
  toTrainingSessionView,
} from '../shared-render/upcoming-training-sessions';
import {
  forEquipment,
  MeetupTrainingView,
  upcomingMeetupTrainings,
} from '../shared-render/meetup-trainings';

// Somebody not trained on the machine who has said they want to be: by
// passing its quiz, by telling the trainers, or both.
export type WaitingMember = {
  memberNumber: number;
  name: O.Option<string>;
  // From passing the quiz, when they have; otherwise from first telling the
  // trainers.
  waitingSince: Date;
  passedQuiz: boolean;
  lastExpressedInterest: O.Option<Date>;
  // The soonest upcoming session they are booked on.
  bookedOn: O.Option<Date>;
};

export type ViewModel = {
  equipment: {id: UUID; name: string};
  // Trainers arrange; owners and super-users see the page to know how
  // training on the machine is going.
  canArrange: boolean;
  // Soonest first: the next one is what a trainer is most likely checking.
  upcoming: ReadonlyArray<TrainingSessionView>;
  // Most recent first: the last few are the ones worth copying.
  previous: ReadonlyArray<TrainingSessionView>;
  // The latest session the trainer reading the page arranged here, upcoming
  // or not: most trainers run the same session again and again.
  lastOwnSessionId: O.Option<UUID>;
  // Longest waiting first.
  waiting: ReadonlyArray<WaitingMember>;
  // This machine's upcoming trainings on Meetup, soonest first.
  meetupTrainings: ReadonlyArray<MeetupTrainingView>;
  now: Date;
};

const internalError = (deps: Dependencies) => (error: string) => {
  deps.logger.error('Failed to read quiz results for waiting list: %s', error);
  return failureWithStatus(
    'Internal Error',
    StatusCodes.INTERNAL_SERVER_ERROR
  )();
};

// Members who passed the quiz in the last year and are not trained, the
// earliest pass for each.
const quizPasses = (
  deps: Dependencies,
  equipment: Equipment
): TE.TaskEither<FailureWithStatus, ReadonlyMap<number, Date>> =>
  O.isNone(equipment.trainingSheetId)
    ? TE.right(new Map())
    : pipe(
        getFullQuizResultsForEquipment(
          deps,
          equipment.trainingSheetId.value,
          equipment
        ),
        TE.mapLeft(internalError(deps)),
        TE.map(results => {
          const earliest = new Map<number, Date>();
          for (const member of results.membersAwaitingTraining) {
            const known = earliest.get(member.memberNumber);
            if (known === undefined || member.waitingSince < known) {
              earliest.set(member.memberNumber, member.waitingSince);
            }
          }
          return earliest;
        })
      );

const waitingList = (
  deps: Dependencies,
  equipment: Equipment,
  passes: ReadonlyMap<number, Date>,
  now: Date
): ReadonlyArray<WaitingMember> => {
  const trained = new Set(
    equipment.trainedMembers.map(member => member.memberNumber)
  );
  const interest = new Map(
    deps.sharedReadModel.trainingInterest
      .forEquipment(equipment.id)
      .filter(row => !trained.has(row.memberNumber))
      .map(row => [row.memberNumber, row])
  );
  const upcoming = deps.sharedReadModel.trainingSessions.upcomingForEquipment(
    equipment.id,
    now
  );
  const memberNumbers = new Set([...passes.keys(), ...interest.keys()]);
  return [...memberNumbers]
    .map(memberNumber => {
      const passedAt = passes.get(memberNumber);
      const said = interest.get(memberNumber);
      return {
        memberNumber,
        name: pipe(
          deps.sharedReadModel.members.getByMemberNumber(memberNumber),
          O.chain(member => member.name)
        ),
        // Every member here passed the quiz or said so, so one of the two is
        // always there.
        waitingSince: passedAt ?? said?.firstExpressedAt ?? now,
        passedQuiz: passedAt !== undefined,
        lastExpressedInterest: O.fromNullable(said?.lastExpressedAt),
        bookedOn: O.fromNullable(
          upcoming.find(session => session.attendees.includes(memberNumber))
            ?.startsAt
        ),
      };
    })
    .sort((a, b) => a.waitingSince.getTime() - b.waitingSince.getTime());
};

// Who is waiting for training on a machine, longest first - for any page
// that wants to say so, not only this one.
export const waitingForTraining = (
  deps: Dependencies,
  equipment: Equipment,
  now: Date
): TE.TaskEither<FailureWithStatus, ReadonlyArray<WaitingMember>> =>
  pipe(
    quizPasses(deps, equipment),
    TE.map(passes => waitingList(deps, equipment, passes, now))
  );

export const constructViewModel =
  (deps: Dependencies, user: User, now: Date) =>
  (equipmentId: UUID): TE.TaskEither<FailureWithStatus, ViewModel> => {
    const actor: Actor = {tag: 'user', user};
    const rm = deps.sharedReadModel;
    return pipe(
      rm.equipment.get(equipmentId),
      TE.fromOption(
        failureWithStatus('Unknown equipment', StatusCodes.NOT_FOUND)
      ),
      TE.bindTo('equipment'),
      TE.let('canArrange', ({equipment}) =>
        isEquipmentTrainer({actor, rm, input: {equipmentId: equipment.id}})
      ),
      TE.filterOrElse(
        ({equipment, canArrange}) =>
          canArrange ||
          isEquipmentOwner({actor, rm, input: {equipmentId: equipment.id}}) ||
          isAdminOrSuperUser({actor, rm}),
        () =>
          failureWithStatus(
            'Only trainers and owners of this equipment can see its trainings',
            StatusCodes.FORBIDDEN
          )()
      ),
      TE.bind('waiting', ({equipment}) =>
        waitingForTraining(deps, equipment, now)
      ),
      TE.bind('meetup', () => upcomingMeetupTrainings(deps, now)),
      TE.map(({equipment, canArrange, waiting, meetup}) => {
        // Latest first.
        const sessions = rm.trainingSessions.allForEquipment(equipment.id);
        const view = toTrainingSessionView(rm, equipment);
        return {
          equipment: {id: equipment.id, name: equipment.name},
          canArrange,
          upcoming: sessions
            .filter(session => session.endsAt > now)
            .map(view)
            .reverse(),
          previous: sessions
            .filter(session => session.endsAt <= now)
            .map(view),
          lastOwnSessionId: pipe(
            sessions.find(
              session => session.trainerMemberNumber === user.memberNumber
            ),
            O.fromNullable,
            O.map(session => session.id)
          ),
          waiting,
          meetupTrainings: forEquipment(meetup, equipment.id),
          now,
        };
      })
    );
  };
