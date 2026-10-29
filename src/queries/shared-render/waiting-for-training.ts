import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {Dependencies} from '../../dependencies';
import {Equipment} from '../../read-models/shared-state/return-types';
import {
  FullQuizResultsForEquipment,
  getFullQuizResultsForEquipment,
  knownInactiveInRecurly,
} from '../../read-models/external-state/equipment-quiz';
import {memberRecurlyEmails} from '../../read-models/external-state/recurly-account-match';
import {
  failureWithStatus,
  FailureWithStatus,
} from '../../types/failure-with-status';

// Somebody not trained on the machine who has said they want to be: by
// passing its quiz, by telling the trainers, or both. One list, behind every
// "waiting for training" number in the app, so they all agree.
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
  // A quiz pass under a member number that matches no account - usually a
  // typo by a real member, so it still counts.
  noAccount: boolean;
  // Recurly shows no active subscription for them. Not counted, but kept:
  // the Recurly match is not always right (an account under an address the
  // app does not know), so pages can show them on request.
  inactiveInRecurly: boolean;
};

// The members who count: everyone but those Recurly says have lapsed.
export const counted = (waiting: ReadonlyArray<WaitingMember>) =>
  waiting.filter(member => !member.inactiveInRecurly);

const quizResultsFor = (
  deps: Dependencies,
  equipment: Equipment
): TE.TaskEither<FailureWithStatus, O.Option<FullQuizResultsForEquipment>> =>
  O.isNone(equipment.trainingSheetId)
    ? TE.right(O.none)
    : pipe(
        getFullQuizResultsForEquipment(
          deps,
          equipment.trainingSheetId.value,
          equipment
        ),
        TE.map(O.some),
        TE.mapLeft(error => {
          deps.logger.error(
            'Failed to read quiz results for waiting list: %s',
            error
          );
          return failureWithStatus(
            'Internal Error',
            StatusCodes.INTERNAL_SERVER_ERROR
          )();
        })
      );

type Pass = {at: Date; inactive: boolean; noAccount: boolean};

const passesFrom = (
  quizResults: O.Option<FullQuizResultsForEquipment>
): ReadonlyMap<number, Pass> => {
  const passes = new Map<number, Pass>();
  if (O.isNone(quizResults)) {
    return passes;
  }
  const results = quizResults.value;
  for (const member of results.membersAwaitingTraining) {
    passes.set(member.memberNumber, {
      at: member.waitingSince,
      inactive: false,
      noAccount: false,
    });
  }
  for (const member of results.inactiveMembersAwaitingTraining) {
    passes.set(member.memberNumber, {
      at: member.waitingSince,
      inactive: true,
      noAccount: false,
    });
  }
  for (const pass of results.unknownMembersAwaitingTraining) {
    if (O.isSome(pass.memberNumberProvided)) {
      passes.set(pass.memberNumberProvided.value, {
        at: pass.waitingSince,
        inactive: false,
        noAccount: true,
      });
    }
  }
  return passes;
};

// The same Recurly rule the quiz results use, for those who only told the
// trainers. Fails open, as the quiz results do: if Recurly cannot be read,
// nobody is hidden.
const interestOnlyInactive = async (
  deps: Dependencies,
  memberNumbers: ReadonlyArray<number>
): Promise<ReadonlySet<number>> => {
  const emails = new Map<number, ReadonlyArray<string>>();
  for (const memberNumber of memberNumbers) {
    const member = deps.sharedReadModel.members.getByMemberNumber(memberNumber);
    if (O.isSome(member)) {
      emails.set(memberNumber, memberRecurlyEmails(member.value));
    }
  }
  try {
    return await knownInactiveInRecurly(deps.extDB)(emails);
  } catch (error) {
    deps.logger.warn(
      '%s; leaving those who asked for training unfiltered',
      `Failed to read Recurly status: ${String(error)}`
    );
    return new Set();
  }
};

// Who is waiting on a machine, longest first, from quiz results already in
// hand - for the equipment page, which has them for other reasons.
export const waitingFromQuizResults = (
  deps: Dependencies,
  equipment: Equipment,
  quizResults: O.Option<FullQuizResultsForEquipment>,
  now: Date
): TE.TaskEither<FailureWithStatus, ReadonlyArray<WaitingMember>> => {
  const rm = deps.sharedReadModel;
  const trained = new Set(
    equipment.trainedMembers.map(member => member.memberNumber)
  );
  const passes = passesFrom(quizResults);
  const interest = new Map(
    rm.trainingInterest
      .forEquipment(equipment.id)
      .filter(row => !trained.has(row.memberNumber))
      .map(row => [row.memberNumber, row])
  );
  const interestOnly = [...interest.keys()].filter(
    memberNumber => !passes.has(memberNumber)
  );
  const upcoming = rm.trainingSessions.upcomingForEquipment(equipment.id, now);
  return pipe(
    TE.fromTask(() => interestOnlyInactive(deps, interestOnly)),
    TE.map(inactiveInterest =>
      [...new Set([...passes.keys(), ...interest.keys()])]
        .map(memberNumber => {
          const pass = passes.get(memberNumber);
          const said = interest.get(memberNumber);
          return {
            memberNumber,
            name: pipe(
              rm.members.getByMemberNumber(memberNumber),
              O.chain(member => member.name)
            ),
            // Every member here passed the quiz or said so, so one of the
            // two is always there.
            waitingSince: pass?.at ?? said?.firstExpressedAt ?? now,
            passedQuiz: pass !== undefined,
            lastExpressedInterest: O.fromNullable(said?.lastExpressedAt),
            bookedOn: O.fromNullable(
              upcoming.find(session =>
                session.attendees.includes(memberNumber)
              )?.startsAt
            ),
            noAccount: pass?.noAccount ?? false,
            inactiveInRecurly:
              pass?.inactive ?? inactiveInterest.has(memberNumber),
          };
        })
        .sort((a, b) => a.waitingSince.getTime() - b.waitingSince.getTime())
    )
  );
};

// Who is waiting for training on a machine, longest first.
export const waitingForTraining = (
  deps: Dependencies,
  equipment: Equipment,
  now: Date
): TE.TaskEither<FailureWithStatus, ReadonlyArray<WaitingMember>> =>
  pipe(
    quizResultsFor(deps, equipment),
    TE.chain(quizResults =>
      waitingFromQuizResults(deps, equipment, quizResults, now)
    )
  );
