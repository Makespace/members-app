import * as O from 'fp-ts/Option';
import {v4 as uuidv4} from 'uuid';
import {Dependencies} from '../dependencies';
import {Actor} from '../types/actor';
import {constructEvent} from '../types';
import {getTrainingQuizCandidates} from '../read-models/external-state/training-quiz-candidates';
import {TimelineRow} from './plan-timeline-rebuild';
import {TimelineRebuildSummary} from './rebuild-event-timeline';

const BACKFILL_ACTOR: Actor = {tag: 'token', token: 'admin'};

// The ONE-TIME historical catch-up: take every cached quiz row that has not yet
// been imported and weave it into the event log at the point in time it
// actually happened (recordedAt = the quiz's completedAt). Idempotent - once a
// row is in the log (matched by rowHash) it is skipped, so a second run inserts
// nothing and leaves the log untouched.
//
// Going forward, new completions are recorded by the ordinary append command
// (they are always newer than the tail), so this timeline surgery never needs
// to run again.
export const backfillTrainingQuizTimeline =
  (deps: Dependencies) => async (): Promise<TimelineRebuildSummary> => {
    const sheetToEquipment =
      deps.sharedReadModel.equipment.getTrainingSheetIdMapping();
    const candidates = await getTrainingQuizCandidates(deps.extDB)(
      sheetToEquipment
    );

    const inserts: ReadonlyArray<TimelineRow> = candidates
      .filter(
        candidate =>
          !deps.sharedReadModel.trainingQuiz.hasRowHash(candidate.rowHash)
      )
      .map(candidate => {
        const event = {
          ...constructEvent('TrainingQuizCompleted')({
            trainingSheetId: candidate.sheetId,
            completedAt: candidate.completedAt,
            memberNumberProvided: O.toNullable(candidate.memberNumber),
            emailProvided: O.toNullable(candidate.email),
            score: candidate.score,
            maxScore: candidate.maxScore,
            rowHash: candidate.rowHash,
            actor: BACKFILL_ACTOR,
          }),
          // Place the event at its real historical time, not the run time, so
          // the log stays ordered by recordedAt.
          recordedAt: candidate.completedAt,
        };
        return {
          id: uuidv4(),
          eventType: event.type,
          payload: JSON.stringify(event),
          recordedAtMs: candidate.completedAt.getTime(),
        };
      });

    const summary = await deps.rebuildEventTimeline(inserts);
    deps.logger.info(summary, 'Training quiz timeline backfill complete');
    return summary;
  };
