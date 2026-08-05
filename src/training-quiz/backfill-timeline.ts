import * as O from 'fp-ts/Option';
import {v4 as uuidv4} from 'uuid';
import {UUID} from 'io-ts-types';
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
// Pass an `equipmentId` to catch up just that one piece of equipment's sheet:
// the rewrite renumbers the whole log either way (renumbering is cheap), but
// scoping the *inserts* lets you run one machine as a canary, verify it on prod,
// then do the rest - each run is independently idempotent and there is no
// backup guard to clear between runs.
//
// Going forward, new completions are recorded by the ordinary append command
// (they are always newer than the tail), so this timeline surgery never needs
// to run again.
export const backfillTrainingQuizTimeline =
  (deps: Dependencies) =>
  async (equipmentId?: UUID): Promise<TimelineRebuildSummary> => {
    const fullMapping =
      deps.sharedReadModel.equipment.getTrainingSheetIdMapping();
    // Scope the candidate sheets to a single piece of equipment when asked, so a
    // canary run only weaves in that machine's rows.
    const sheetToEquipment =
      equipmentId === undefined
        ? fullMapping
        : Object.fromEntries(
            Object.entries(fullMapping).filter(
              ([, eqId]) => eqId === equipmentId
            )
          );
    const candidates = await getTrainingQuizCandidates(deps.extDB)(
      sheetToEquipment
    );

    // Dedup against the read model AND within this batch: unlike the append
    // path there is no per-insert read-model refresh here, so two byte-identical
    // sheet rows (same hash) would otherwise both be woven into the log forever.
    const batchHashes = new Set<string>();
    const inserts: ReadonlyArray<TimelineRow> = candidates
      .filter(candidate => {
        if (
          deps.sharedReadModel.trainingQuiz.hasRowHash(candidate.rowHash) ||
          batchHashes.has(candidate.rowHash)
        ) {
          return false;
        }
        batchHashes.add(candidate.rowHash);
        return true;
      })
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
