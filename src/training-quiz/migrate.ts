import * as O from 'fp-ts/Option';
import * as E from 'fp-ts/Either';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {Int} from 'io-ts';
import {NonEmptyString} from 'io-ts-types';
import {Dependencies} from '../dependencies';
import {Actor} from '../types/actor';
import {commands} from '../commands';
import {getTrainingQuizCandidates} from '../read-models/external-state/training-quiz-candidates';

// This driver is the going-forward sync-worker poller's mechanism, so its
// events are system-generated - not an administrator acting via the API.
// Attributing them to the system actor keeps the audit history honest.
const SYSTEM_ACTOR: Actor = {tag: 'system'};

// Just the slice of dependencies this needs, so the sync worker (which does not
// build the full app Dependencies) can run it. Records events directly via
// commitEvent rather than applyCommand for the same reason.
type QuizMigrationDeps = Pick<
  Dependencies,
  'sharedReadModel' | 'extDB' | 'commitEvent' | 'logger'
>;

type QuizMigrationSummary = {
  total: number;
  created: number;
  alreadyImported: number;
  failed: number;
};

// Reads every cached quiz row (sheet_data) and records it as a
// TrainingQuizCompleted event, skipping any already imported (dedup by hash).
// Idempotent and re-runnable.
//
// Deliberately NOT exposed over HTTP: appending claims each row's hash with
// recordedAt = now, which would permanently prevent the one-time timeline
// backfill from weaving that row in at its historical completedAt. This
// function is reserved for the going-forward sync-worker poller, which only
// ever sees fresh rows (where append-at-tail is correct).
//
// Runs sequentially because commitEvent refreshes the read model after each
// append, so the command's dedup check sees events created earlier in this run.
export const runQuizMigration =
  (deps: QuizMigrationDeps) =>
  async (): Promise<QuizMigrationSummary> => {
    const sheetToEquipment =
      deps.sharedReadModel.equipment.getTrainingSheetIdMapping();
    const candidates = await getTrainingQuizCandidates(deps.extDB)(
      sheetToEquipment
    );

    let created = 0;
    let alreadyImported = 0;
    let failed = 0;

    for (const candidate of candidates) {
      if (deps.sharedReadModel.trainingQuiz.hasRowHash(candidate.rowHash)) {
        alreadyImported++;
        continue;
      }
      // The casts restate what the candidate reader guarantees: sheet ids come
      // from the equipment mapping's keys, the hash is sha256 hex, and scores
      // are decoded as integers from the sheet cache.
      const result = await pipe(
        commands.trainingQuiz.record.process({
          command: {
            trainingSheetId: candidate.sheetId as NonEmptyString,
            completedAt: candidate.completedAt,
            memberNumberProvided: O.toNullable(candidate.memberNumber),
            emailProvided: O.toNullable(candidate.email),
            score: candidate.score as Int,
            maxScore: candidate.maxScore as Int,
            rowHash: candidate.rowHash as NonEmptyString,
            actor: SYSTEM_ACTOR,
          },
          rm: deps.sharedReadModel,
        }),
        TE.chain(maybeEvent =>
          O.isSome(maybeEvent)
            ? pipe(
                deps.commitEvent(deps.sharedReadModel.getCurrentEventIndex())(
                  maybeEvent.value
                ),
                TE.map(() => undefined)
              )
            : TE.right(undefined)
        )
      )();
      if (E.isLeft(result)) {
        deps.logger.error(
          result.left,
          'Failed to record a quiz completion during migration'
        );
        failed++;
      } else {
        created++;
      }
    }

    const summary = {total: candidates.length, created, alreadyImported, failed};
    deps.logger.info(summary, 'Quiz migration run complete');
    return summary;
  };
