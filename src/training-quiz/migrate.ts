import * as O from 'fp-ts/Option';
import * as E from 'fp-ts/Either';
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
// Idempotent and re-runnable: this same loop is the one-time backfill AND the
// going-forward poller (call it from the sync worker on a schedule).
//
// Runs sequentially because commitEvent refreshes the read model after each
// append, so the command's dedup check sees events created earlier in this run.
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
      const result = await applyCommand(deps, commands.trainingQuiz.record)(
        {
          trainingSheetId: candidate.sheetId,
          completedAt: candidate.completedAt,
          memberNumberProvided: O.toNullable(candidate.memberNumber),
          emailProvided: O.toNullable(candidate.email),
          score: candidate.score,
          maxScore: candidate.maxScore,
          rowHash: candidate.rowHash,
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
