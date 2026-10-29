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
import {
  WaitingMember,
  waitingForTraining,
} from '../shared-render/waiting-for-training';

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
