import {v4 as uuidv4} from 'uuid';
import {UUID} from 'io-ts-types';
import {Dependencies} from '../dependencies';
import {Actor} from '../types/actor';
import {constructEvent} from '../types';
import {getTroubleTicketCandidates} from '../read-models/external-state/trouble-ticket-candidates';
import {TimelineRow} from '../training-quiz/plan-timeline-rebuild';
import {TimelineRebuildSummary} from '../training-quiz/rebuild-event-timeline';

const BACKFILL_ACTOR: Actor = {tag: 'token', token: 'admin'};

// What a backfill run would do, computed without writing anything. The route
// exposes this as ?dryRun=true so the operator can sanity-check counts (and a
// sample of what would be woven in) before the real run.
type TroubleTicketBackfillPlan = {
  totalCandidates: number;
  wouldInsert: number;
  alreadyImported: number;
  sample: ReadonlyArray<{
    submittedAt: Date;
    submittedEquipment: string | null;
    issue: string;
    rowHash: string;
  }>;
  inserts: ReadonlyArray<TimelineRow>;
};

const SAMPLE_SIZE = 5;

// Builds the timeline rows a backfill run would weave in. Dedups against the
// read model AND within the batch: unlike the append path there is no
// per-insert read-model refresh here, so two byte-identical sheet rows (same
// hash) would otherwise both be woven into the log forever. Pass `before` to
// scope the *inserts* to submissions strictly before that date (a canary run);
// the rewrite renumbers the whole log either way, and each run is
// independently idempotent.
export const planTroubleTicketBackfill =
  (deps: Pick<Dependencies, 'sharedReadModel' | 'extDB'>) =>
  async (before?: Date): Promise<TroubleTicketBackfillPlan> => {
    const candidates = await getTroubleTicketCandidates(deps.extDB);

    const batchHashes = new Set<string>();
    let alreadyImported = 0;
    const toInsert = candidates.filter(candidate => {
      if (
        deps.sharedReadModel.troubleTickets.hasRowHash(candidate.rowHash) ||
        batchHashes.has(candidate.rowHash)
      ) {
        alreadyImported++;
        return false;
      }
      if (before !== undefined && candidate.submittedAt >= before) {
        return false;
      }
      batchHashes.add(candidate.rowHash);
      return true;
    });

    const inserts: ReadonlyArray<TimelineRow> = toInsert.map(candidate => {
      const event = {
        ...constructEvent('TroubleTicketCreated')({
          id: uuidv4() as UUID,
          rowHash: candidate.rowHash,
          sheetId: candidate.sheetId,
          submittedAt: candidate.submittedAt,
          submittedMemberNumber: candidate.submittedMemberNumber,
          submittedEmail: candidate.submittedEmail,
          submittedName: candidate.submittedName,
          submittedEquipment: candidate.submittedEquipment,
          otherEquipmentDetail: candidate.response.otherEquipmentDetail,
          status: candidate.response.status,
          attempting: candidate.response.attempting,
          issue: candidate.response.issue,
          steps: candidate.response.steps,
          actor: BACKFILL_ACTOR,
        }),
        // Place the event at its real historical time, not the run time, so
        // the log stays ordered by recordedAt.
        recordedAt: candidate.submittedAt,
      };
      return {
        id: uuidv4(),
        eventType: event.type,
        payload: JSON.stringify(event),
        recordedAtMs: candidate.submittedAt.getTime(),
      };
    });

    return {
      totalCandidates: candidates.length,
      wouldInsert: inserts.length,
      alreadyImported,
      sample: toInsert.slice(0, SAMPLE_SIZE).map(candidate => ({
        submittedAt: candidate.submittedAt,
        submittedEquipment: candidate.submittedEquipment,
        issue: candidate.response.issue,
        rowHash: candidate.rowHash.slice(0, 12),
      })),
      inserts,
    };
  };

// The ONE-TIME historical catch-up: take every cached trouble-ticket row that
// has not yet been imported and weave it into the event log at the point in
// time it actually happened (recordedAt = the ticket's submittedAt).
// Idempotent - once a row is in the log (matched by rowHash) it is skipped, so
// a second run inserts nothing and leaves the log untouched.
//
// Going forward, new tickets are recorded by the ordinary append path (they
// are always newer than the tail), so this timeline surgery never needs to run
// again.
export const backfillTroubleTicketTimeline =
  (deps: Dependencies) =>
  async (before?: Date): Promise<TimelineRebuildSummary> => {
    const plan = await planTroubleTicketBackfill(deps)(before);
    const summary = await deps.rebuildEventTimeline(plan.inserts);
    deps.logger.info(summary, 'Trouble ticket timeline backfill complete');
    return summary;
  };
