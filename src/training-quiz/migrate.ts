import * as O from 'fp-ts/Option';
import * as E from 'fp-ts/Either';
import {Int} from 'io-ts';
import {NonEmptyString} from 'io-ts-types';
import {Dependencies} from '../dependencies';
import {Actor} from '../types/actor';
import {applyCommand} from '../commands/apply-command';
import {commands} from '../commands';
import {getTrainingQuizCandidates} from '../read-models/external-state/training-quiz-candidates';

const MIGRATION_ACTOR: Actor = {tag: 'token', token: 'admin'};

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
// ts-unused-exports:disable-next-line
export const runQuizMigration =
  (deps: Dependencies) =>
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
      const result = await applyCommand(deps, commands.trainingQuiz.record)(
        {
          trainingSheetId: candidate.sheetId as NonEmptyString,
          completedAt: candidate.completedAt,
          memberNumberProvided: O.toNullable(candidate.memberNumber),
          emailProvided: O.toNullable(candidate.email),
          score: candidate.score as Int,
          maxScore: candidate.maxScore as Int,
          rowHash: candidate.rowHash as NonEmptyString,
        },
        MIGRATION_ACTOR
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
