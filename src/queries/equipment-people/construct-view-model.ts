import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {UUID} from 'io-ts-types';
import {Dependencies} from '../../dependencies';
import {User, EmailAddress} from '../../types';
import {EmailAddressCodec} from '../../types/email-address';
import {FailureWithStatus} from '../../types/failure-with-status';
import {constructViewModel as constructEquipmentViewModel} from '../equipment/construct-view-model';
import {
  FullQuizResultsForEquipment,
  OrphanedPassedQuiz,
  QuizRow,
} from '../../read-models/external-state/equipment-quiz';
import {SharedReadModel} from '../../read-models/shared-state';
import {
  allMemberNumbers,
  MemberCoreInfo,
  TrainedMember,
} from '../../read-models/shared-state/return-types';

// Everything the lists show about one person, in the shape the shared member
// renderer wants: name, number and address in one cell.
export type PersonSummary = {
  name: O.Option<string>;
  memberNumber: number;
  primaryEmailAddress: O.Option<EmailAddress>;
};

type TrainedPerson = PersonSummary & {
  trainedSince: Date;
  trainedByMemberNumber: O.Option<number>;
};

// Where a member stands with this machine's quiz: passed and waiting to be
// trained, trained already, or no pass on record (the quiz results only go
// back a year, so "none" means none recently).
type QuizStanding =
  | {kind: 'passed'; at: Date}
  | {kind: 'trained'; since: Date}
  | {kind: 'not-passed'};

// One row of the training table. A known member carries their standing; a
// pass the app could not match to anybody carries what the form was given,
// and whoever that address belongs to if it belongs to somebody.
export type TrainingRow =
  | {kind: 'member'; person: PersonSummary; standing: QuizStanding}
  | {
      kind: 'unknown';
      waitingSince: Date;
      memberNumberProvided: O.Option<number>;
      emailProvided: O.Option<string>;
      possibleMatch: O.Option<PersonSummary>;
    };

export type ViewModel = {
  equipment: {id: UUID; name: string};
  // Trainers and owners act on these lists; everyone else may read the
  // trained list only.
  isTrainer: boolean;
  isTrainerOrOwner: boolean;
  trained: ReadonlyArray<TrainedPerson>;
  // Everybody who has passed the quiz and not been trained, known or not,
  // most recent pass first.
  waiting: ReadonlyArray<TrainingRow>;
  // What was typed into the search box and who matched it. A match is shown
  // whether or not they have passed the quiz: an empty table would leave a
  // trainer wondering whether the search failed or the person did.
  search: O.Option<{query: string; results: ReadonlyArray<TrainingRow>}>;
  failed: ReadonlyArray<QuizRow>;
  lastQuizSync: O.Option<Date>;
};

// A search shows this many at most; a name or address that matches more
// than this is not yet a search for one person.
export const SEARCH_RESULT_LIMIT = 25;

const summarise = (member: MemberCoreInfo): PersonSummary => ({
  name: member.name,
  memberNumber: member.memberNumber,
  primaryEmailAddress: O.some(member.primaryEmailAddress),
});

const rowDate = (row: TrainingRow): Date =>
  row.kind === 'unknown'
    ? row.waitingSince
    : row.standing.kind === 'not-passed'
      ? new Date(0)
      : row.standing.kind === 'passed'
        ? row.standing.at
        : row.standing.since;

const mostRecentFirst = (a: TrainingRow, b: TrainingRow) =>
  rowDate(b).getTime() - rowDate(a).getTime();

// A pass the app could not match still names an address, and that address
// may well belong to a member whose number was typed wrong. Saying so is
// not the same as linking them - only adding the address to their record
// does that - but it points at who to ask.
const toUnknownRow =
  (rm: SharedReadModel) =>
  (quiz: OrphanedPassedQuiz): TrainingRow => ({
    kind: 'unknown',
    waitingSince: quiz.waitingSince,
    memberNumberProvided: quiz.memberNumberProvided,
    emailProvided: quiz.emailProvided,
    possibleMatch: pipe(
      quiz.emailProvided,
      O.chain(email => O.fromEither(EmailAddressCodec.decode(email))),
      O.chain(email => rm.members.getByEmail(email, false)),
      O.map(summarise)
    ),
  });

const toWaitingRows = (
  rm: SharedReadModel,
  results: FullQuizResultsForEquipment
): ReadonlyArray<TrainingRow> =>
  [
    ...results.membersAwaitingTraining.map(
      (member): TrainingRow => ({
        kind: 'member',
        person: {
          name: member.name,
          memberNumber: member.memberNumber,
          primaryEmailAddress: pipe(
            rm.members.getByMemberNumber(member.memberNumber),
            O.map(found => found.primaryEmailAddress)
          ),
        },
        standing: {kind: 'passed', at: member.waitingSince},
      })
    ),
    ...results.unknownMembersAwaitingTraining.map(toUnknownRow(rm)),
  ].sort(mostRecentFirst);

// A number finds exactly that member - including somebody who used to have
// it - so typing 872 shows one account, not everybody with 872 somewhere in
// their address. Anything else matches part of a name or an address.
const matchesMember =
  (query: string) =>
  (member: MemberCoreInfo): boolean => {
    if (/^\d+$/.test(query)) {
      return allMemberNumbers(member).includes(Number(query));
    }
    const needle = query.toLowerCase();
    return (
      pipe(
        member.name,
        O.exists(name => name.toLowerCase().includes(needle))
      ) ||
      member.emails.some(email =>
        email.emailAddress.toLowerCase().includes(needle)
      )
    );
  };

const matchesUnknown =
  (query: string) =>
  (quiz: OrphanedPassedQuiz): boolean =>
    /^\d+$/.test(query)
      ? pipe(
          quiz.memberNumberProvided,
          O.exists(number => number === Number(query))
        )
      : pipe(
          quiz.emailProvided,
          O.exists(email => email.toLowerCase().includes(query.toLowerCase()))
        );

const standingOf = (
  member: MemberCoreInfo,
  trainedMembers: ReadonlyArray<TrainedMember>,
  results: O.Option<FullQuizResultsForEquipment>
): QuizStanding => {
  const trained = trainedMembers.find(
    t => t.memberNumber === member.memberNumber
  );
  if (trained !== undefined) {
    return {kind: 'trained', since: trained.trainedSince};
  }
  return pipe(
    results,
    O.chain(r =>
      O.fromNullable(
        r.membersAwaitingTraining.find(
          waiting => waiting.memberNumber === member.memberNumber
        )
      )
    ),
    O.match(
      (): QuizStanding => ({kind: 'not-passed'}),
      (waiting): QuizStanding => ({kind: 'passed', at: waiting.waitingSince})
    )
  );
};

const byName = (a: TrainingRow, b: TrainingRow) => {
  const nameOf = (row: TrainingRow) =>
    row.kind === 'member'
      ? O.getOrElse(() => '')(row.person.name).toLowerCase()
      : '';
  return nameOf(a).localeCompare(nameOf(b));
};

const searchRows = (
  rm: SharedReadModel,
  trainedMembers: ReadonlyArray<TrainedMember>,
  results: O.Option<FullQuizResultsForEquipment>,
  query: string
): ReadonlyArray<TrainingRow> => {
  const members: ReadonlyArray<TrainingRow> = rm.members
    .getAllCore()
    .filter(matchesMember(query))
    .map(member => ({
      kind: 'member',
      person: summarise(member),
      standing: standingOf(member, trainedMembers, results),
    }));
  const unknowns: ReadonlyArray<TrainingRow> = pipe(
    results,
    O.match(
      () => [],
      r => r.unknownMembersAwaitingTraining.filter(matchesUnknown(query))
    ),
    quizzes => quizzes.map(toUnknownRow(rm))
  );
  return [...members, ...unknowns].sort(byName).slice(0, SEARCH_RESULT_LIMIT);
};

export const constructViewModel =
  (deps: Dependencies, user: User) =>
  (
    equipmentId: UUID,
    searchQuery: O.Option<string>
  ): TE.TaskEither<FailureWithStatus, ViewModel> =>
    pipe(
      constructEquipmentViewModel(deps, user)(equipmentId),
      TE.map(equipmentView => ({
        equipment: {
          id: equipmentView.equipment.id,
          name: equipmentView.equipment.name,
        },
        isTrainer: equipmentView.isSuperUserOrTrainerOfArea,
        isTrainerOrOwner:
          equipmentView.isSuperUserOrTrainerOfArea ||
          equipmentView.isSuperUserOrOwnerOfArea,
        trained: equipmentView.equipment.trainedMembers.map(member => ({
          name: member.name,
          memberNumber: member.memberNumber,
          primaryEmailAddress: O.some(member.primaryEmailAddress),
          trainedSince: member.trainedSince,
          trainedByMemberNumber: member.trainedByMemberNumber,
        })),
        // Most recent pass first: the people a trainer is most likely to be
        // about to hear from, and the ones a glance should find.
        waiting: pipe(
          equipmentView.quizResults,
          O.match(
            () => [],
            results => toWaitingRows(deps.sharedReadModel, results)
          )
        ),
        search: pipe(
          searchQuery,
          O.map(query => query.trim()),
          O.filter(query => query !== ''),
          O.map(query => ({
            query,
            results: searchRows(
              deps.sharedReadModel,
              equipmentView.equipment.trainedMembers,
              equipmentView.quizResults,
              query
            ),
          }))
        ),
        failed: pipe(
          equipmentView.quizResults,
          O.match(
            () => [],
            results =>
              [...results.failedQuizes].sort(
                (a, b) => b.completedAt.getTime() - a.completedAt.getTime()
              )
          )
        ),
        lastQuizSync: pipe(
          equipmentView.quizResults,
          O.chain(results => results.lastQuizSync)
        ),
      }))
    );
