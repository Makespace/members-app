import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {Int} from 'io-ts';
import {NonEmptyString, UUID} from 'io-ts-types';
import {v4} from 'uuid';
import {Dependencies} from '../dependencies';
import {Actor} from '../types/actor';
import {commands} from '../commands';
import {getTroubleTicketCandidates} from '../read-models/external-state/trouble-ticket-candidates';

// This driver is the going-forward sync-worker poller's mechanism, so its
// events are system-generated - not an administrator acting via the API.
const SYSTEM_ACTOR: Actor = {tag: 'system'};

// Just the slice of dependencies this needs, so the sync worker (which does not
// build the full app Dependencies) can run it. Records events directly via
// commitEvent rather than applyCommand for the same reason.
type TroubleTicketIngestDeps = Pick<
  Dependencies,
  'sharedReadModel' | 'extDB' | 'commitEvent' | 'logger'
>;

type TroubleTicketIngestSummary = {
  total: number;
  created: number;
  alreadyImported: number;
  failed: number;
};

// Reads every cached trouble-ticket row and records it as a
// TroubleTicketCreated event, skipping any already imported (dedup by hash).
// Idempotent and re-runnable.
//
// Deliberately NOT exposed over HTTP and NOT yet wired into the sync worker:
// appending claims each row's hash with recordedAt = now, which would
// permanently prevent the one-time timeline backfill from weaving that row in
// at its historical submittedAt. This function is reserved for the
// going-forward sync-worker poller, which only ever sees fresh rows (where
// append-at-tail is correct) and must only be wired up after the backfill has
// run and been verified on prod.
//
// Runs sequentially because commitEvent refreshes the read model after each
// append, so the command's dedup check sees events created earlier in this run.
export const runTroubleTicketIngest =
  (deps: TroubleTicketIngestDeps) =>
  async (): Promise<TroubleTicketIngestSummary> => {
    const {candidates, skippedNoTimestamp} = await getTroubleTicketCandidates(
      deps.extDB
    );
    if (skippedNoTimestamp > 0) {
      deps.logger.warn(
        {skippedNoTimestamp},
        'Skipped cached trouble-ticket rows with no usable submission timestamp'
      );
    }

    let created = 0;
    let alreadyImported = 0;
    let failed = 0;

    for (const candidate of candidates) {
      if (deps.sharedReadModel.troubleTickets.hasRowHash(candidate.rowHash)) {
        alreadyImported++;
        continue;
      }
      // The casts restate what the candidate reader guarantees: sheet ids and
      // hashes are non-empty, and the member number is decoded as an integer
      // from the sheet cache.
      const result = await pipe(
        commands.troubleTickets.record.process({
          command: {
            id: v4() as UUID,
            rowHash: candidate.rowHash as NonEmptyString,
            sheetId: candidate.sheetId as NonEmptyString,
            submittedAt: candidate.submittedAt,
            submittedMemberNumber: candidate.submittedMemberNumber as Int | null,
            submittedEmail: candidate.submittedEmail,
            submittedName: candidate.submittedName,
            submittedEquipment: candidate.submittedEquipment,
            otherEquipmentDetail: candidate.response.otherEquipmentDetail,
            status: candidate.response.status,
            attempting: candidate.response.attempting,
            issue: candidate.response.issue,
            steps: candidate.response.steps,
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
          'Failed to record a trouble ticket during ingest'
        );
        failed++;
      } else {
        created++;
      }
    }

    const summary = {total: candidates.length, created, alreadyImported, failed};
    deps.logger.info(summary, 'Trouble ticket ingest run complete');
    return summary;
  };
