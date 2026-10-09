import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import * as RR from 'fp-ts/ReadonlyRecord';

import {Dependencies} from '../../dependencies';
import {pipe} from 'fp-ts/lib/function';
import {Equipment, MemberCoreInfo} from '../shared-state/return-types';
import {DateTime, Duration} from 'luxon';
import {ReadonlyRecord} from 'fp-ts/lib/ReadonlyRecord';
import {EquipmentId} from '../../types/equipment-id';
import {TrainingQuizCompletionRow} from '../shared-state/training-quiz/get';
import {getActiveStatusByEmail} from './recurly-status';
import {
  loadAccountCodesAmong,
  memberRecurlyEmails,
  resolveAccountEmailsFrom,
} from './recurly-account-match';

export type OrphanedPassedQuiz = {
  waitingSince: Date;
  memberNumberProvided: O.Option<number>;
  emailProvided: O.Option<string>;
};

type MemberAwaitingTraining = Pick<
  MemberCoreInfo,
  'memberNumber' | 'name' | 'pastMemberNumbers'
> & {
  waitingSince: Date;
};

// Event-native quiz row carrying only the fields the renderers consume (the
// events table has no sheet_name/row_index/cached_at/percentage columns).
export type QuizRow = {
  completedAt: Date;
  memberNumberProvided: O.Option<number>;
  emailProvided: O.Option<string>;
  score: number;
  maxScore: number;
  percentage: number;
  trainingSheetId: string;
};

// Full marks. The `maxScore > 0` guard avoids a spurious pass on a malformed
// 0/0 row (the old sheet rule was a stored `percentage >= 100`).
const isPassed = (r: {score: number; maxScore: number}) =>
  r.maxScore > 0 && r.score >= r.maxScore;

const toPercentage = (score: number, maxScore: number): number =>
  maxScore === 0 ? 0 : Math.round((score / maxScore) * 100);

const toQuizRow = (row: TrainingQuizCompletionRow): QuizRow => ({
  completedAt: row.completedAt,
  memberNumberProvided: row.memberNumberProvided,
  emailProvided: row.emailProvided,
  score: row.score,
  maxScore: row.maxScore,
  percentage: toPercentage(row.score, row.maxScore),
  trainingSheetId: row.trainingSheetId,
});

export type FullQuizResultsForEquipment = {
  lastQuizSync: O.Option<Date>;
  membersAwaitingTraining: ReadonlyArray<MemberAwaitingTraining>;
  unknownMembersAwaitingTraining: ReadonlyArray<OrphanedPassedQuiz>;
  failedQuizes: ReadonlyArray<QuizRow>;
};

// Everything the two passes between lastQuizSync and the Recurly filter hand
// to each other: the published results plus the matchable member addresses
// collected on the way, so the Recurly check needs no second lookup per
// member.
type QuizResultsWithRecurlyEmails = FullQuizResultsForEquipment & {
  recurlyEmailsByMemberNumber: Map<number, string[]>;
};

export const getFullQuizResultsForEquipment = (
  deps: Pick<
    Dependencies,
    'sharedReadModel' | 'lastQuizSync' | 'extDB' | 'logger'
  >,
  sheetId: string,
  equipment: Equipment
): TE.TaskEither<string, FullQuizResultsForEquipment> =>
  pipe(
    // The sheet cache still syncs, so lastQuizSync remains the "data last
    // refreshed" signal shown on the page even though quiz rows now come from
    // events.
    deps.lastQuizSync(sheetId),
    TE.map(lastQuizSync => {
      const completions =
        deps.sharedReadModel.trainingQuiz.getCompletionsForSheet(
          sheetId,
          O.some(
            DateTime.now().minus(Duration.fromObject({year: 1})).toJSDate()
          )
        );

      const membersAwaitingTraining: MemberAwaitingTraining[] = [];
      const unknownMembersAwaitingTraining: OrphanedPassedQuiz[] = [];
      const trainedMemberNumbers = equipment.trainedMembers.map(
        m => m.memberNumber
      );

      // A member enters the queue when they pass (full marks - a failed
      // attempt never creates or moves an entry), and may pass any number of
      // times; they appear once, waiting since their earliest pass (within
      // the one-year window) rather than any later retake: passing again
      // while already waiting does not reset the clock. The list is read as a
      // queue, and a voluntary retake should not send someone to the back of
      // it. "Earliest pass" is compared against current trainedMembers only: a
      // member whose training is revoked (RevokeTrainedOnEquipment) reappears
      // here waiting since their original pre-training pass, which with the
      // queue order can put them straight at the front. Accepted for now -
      // scoping passes to after the latest revocation would need the
      // revocation time kept, which the read model does not record.
      // Unknown passes are deduped the same way, keyed on the number as
      // typed.
      const earliestKnownByMemberNumber = new Map<number, MemberAwaitingTraining>();
      const earliestUnknownByMemberNumber = new Map<number, OrphanedPassedQuiz>();
      // Which of each member's addresses may match a Recurly account comes
      // out of the same member lookup that builds the queue entry, so it is
      // kept here rather than fetched again when the Recurly check below
      // runs. memberRecurlyEmails is the codebase's one definition of that
      // (verified addresses, lowercased).
      const recurlyEmailsByMemberNumber = new Map<number, string[]>();

      for (const row of completions.filter(isPassed)) {
        // A passed row with no member number is dropped (not surfaced as
        // unknown) - preserving the previous behaviour.
        if (O.isNone(row.memberNumberProvided)) {
          continue;
        }
        const memberNumber = row.memberNumberProvided.value;
        if (trainedMemberNumbers.includes(memberNumber)) {
          continue;
        }
        const member =
          deps.sharedReadModel.members.getByMemberNumber(memberNumber);
        if (O.isNone(member)) {
          const previous = earliestUnknownByMemberNumber.get(memberNumber);
          if (
            previous === undefined ||
            row.completedAt.getTime() < previous.waitingSince.getTime()
          ) {
            earliestUnknownByMemberNumber.set(memberNumber, {
              waitingSince: row.completedAt,
              memberNumberProvided: row.memberNumberProvided,
              emailProvided: row.emailProvided,
            });
          }
          continue;
        }
        const previous = earliestKnownByMemberNumber.get(memberNumber);
        if (
          previous === undefined ||
          row.completedAt.getTime() < previous.waitingSince.getTime()
        ) {
          earliestKnownByMemberNumber.set(memberNumber, {
            ...member.value,
            waitingSince: row.completedAt,
          });
          recurlyEmailsByMemberNumber.set(
            memberNumber,
            [...memberRecurlyEmails(member.value)]
          );
        }
      }

      membersAwaitingTraining.push(...earliestKnownByMemberNumber.values());
      unknownMembersAwaitingTraining.push(...earliestUnknownByMemberNumber.values());

      return {
        lastQuizSync,
        failedQuizes: completions.filter(row => !isPassed(row)).map(toQuizRow),
        membersAwaitingTraining,
        unknownMembersAwaitingTraining,
        recurlyEmailsByMemberNumber,
      };
    }),
    // Someone no longer a member is not queueing for anything, so known
    // members with a fresh inactive Recurly status are dropped. No fresh
    // Recurly row at all is treated as still-active: the safer failure mode
    // is to keep showing demand when the cache has gone stale. Unknown rows
    // (a member number that matches no account) are kept - there is no
    // account to attach a status to, and the quiz-results page shows them.
    //
    // The whole queue is checked in one bulk query rather than one per
    // member: a machine with a long waiting list must not multiply the cost
    // of the equipment page.
    TE.chain((results: QuizResultsWithRecurlyEmails) => {
      const dropInactive = async (): Promise<FullQuizResultsForEquipment> => {
        const {recurlyEmailsByMemberNumber, ...published} = results;
        const allAddresses = [
          ...new Set([...recurlyEmailsByMemberNumber.values()].flat()),
        ];
        // Two queries total: one to resolve account codes to billing emails,
        // one for the subscription rows those emails name.
        const resolveBillingEmails = resolveAccountEmailsFrom(
          await loadAccountCodesAmong(deps.extDB)(allAddresses)
        );
        const activeByEmail = await getActiveStatusByEmail(deps.extDB)(
          allAddresses
        );
        return {
          ...published,
          membersAwaitingTraining: published.membersAwaitingTraining.filter(
            member => {
              const addresses =
                recurlyEmailsByMemberNumber.get(member.memberNumber) ?? [];
              const billingEmails = resolveBillingEmails(addresses);
              // No fresh row for any of their billing emails = no data =
              // keep them (a stale cache must not empty the list).
              const matched = billingEmails.filter(email =>
                activeByEmail.has(email)
              );
              if (matched.length === 0) {
                return true;
              }
              return matched.some(email => activeByEmail.get(email) === true);
            }
          ),
        };
      };

      // A Recurly read failure must not take down the page over a stat:
      // log it and keep everyone, matching the rule that a stale cache
      // should not empty the list.
      return pipe(
        TE.tryCatch(
          dropInactive,
          err => `Failed to read Recurly status: ${String(err)}`
        ),
        TE.orElse(error => {
          deps.logger.warn(
            '%s; leaving the waiting-for-training list unfiltered',
            error
          );
          const {recurlyEmailsByMemberNumber: _recurlyEmails, ...published} =
            results;
          return TE.right(published);
        })
      );
    })
  );

export type FullQuizResultsForMember = {
  equipmentQuiz: ReadonlyRecord<
    EquipmentId,
    {
      passedAt: ReadonlyArray<Date>;
      attempted: ReadonlyArray<{
        response_submitted: Date;
        sheet_id: string;
        score: number;
        max_score: number;
        percentage: number;
      }>;
    }
  >;
};

export const getFullQuizResultsForMember = (
  deps: Pick<Dependencies, 'sharedReadModel'>,
  memberNumber: number
): TE.TaskEither<string, FullQuizResultsForMember> => {
  const equipmentQuiz: Record<
    EquipmentId,
    {
      passedAt: Date[];
      attempted: {
        response_submitted: Date;
        sheet_id: string;
        score: number;
        max_score: number;
        percentage: number;
      }[];
    }
  > = {};
  const trainingSheetMapping =
    deps.sharedReadModel.equipment.getTrainingSheetIdMapping();

  for (const row of deps.sharedReadModel.trainingQuiz.getCompletionsForMember(
    memberNumber
  )) {
    const equipmentId = RR.lookup(row.trainingSheetId)(trainingSheetMapping);
    if (O.isNone(equipmentId)) {
      continue;
    }
    if (!equipmentQuiz[equipmentId.value]) {
      equipmentQuiz[equipmentId.value] = {passedAt: [], attempted: []};
    }
    if (isPassed(row)) {
      equipmentQuiz[equipmentId.value].passedAt.push(row.completedAt);
    } else {
      equipmentQuiz[equipmentId.value].attempted.push({
        response_submitted: row.completedAt,
        sheet_id: row.trainingSheetId,
        score: row.score,
        max_score: row.maxScore,
        percentage: toPercentage(row.score, row.maxScore),
      });
    }
  }

  return TE.right({equipmentQuiz});
};
