import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {v4} from 'uuid';
import {UUID} from 'io-ts-types';
import {constructEvent} from '../types';
import {SyncWorkerDependencies} from './dependencies';
import {troubleTicketRowHash} from '../trouble-tickets/row-hash';
import {parseResponseJson} from '../trouble-tickets/parse-response';

export type IngestTroubleTicketDependencies = Pick<
  SyncWorkerDependencies,
  'logger' | 'sharedReadModel' | 'getTroubleTicketData' | 'commitEvent'
>;

// Turns cached trouble-ticket sheet rows into TroubleTicketCreated events. Idempotent:
// rows whose rowHash is already in the read model are skipped, so the first run backfills
// all history and later runs only add newly-cached rows. Every ticket starts as 'Todo'.
export const ingestTroubleTickets = async (
  deps: IngestTroubleTicketDependencies
): Promise<void> => {
  // Work from fresh state so dedup reflects everything committed so far.
  await deps.sharedReadModel.asyncRefresh()();

  const rowsResult = await deps.getTroubleTicketData(O.none)();
  if (E.isLeft(rowsResult)) {
    deps.logger.warn(
      'Failed to read trouble ticket cache for ingest: %s',
      rowsResult.left
    );
    return;
  }
  if (O.isNone(rowsResult.right)) {
    // No trouble ticket sheet configured - nothing to ingest.
    return;
  }
  const rows = rowsResult.right.value;

  let created = 0;
  for (const row of rows) {
    const rowHash = troubleTicketRowHash({
      sheetId: row.sheet_id,
      submittedAt: row.response_submitted,
      submittedEmail: row.submitted_email,
      submittedMemberNumber: row.submitted_membership_number,
      submittedEquipment: row.submitted_equipment,
      responseJson: row.submitted_response_json,
    });
    if (deps.sharedReadModel.troubleTickets.hasRowHash(rowHash)) {
      continue;
    }
    const response = parseResponseJson(row.submitted_response_json);
    const event = constructEvent('TroubleTicketCreated')({
      actor: {tag: 'system'},
      id: v4() as UUID,
      rowHash,
      sheetId: row.sheet_id,
      submittedAt: row.response_submitted,
      submittedMemberNumber: row.submitted_membership_number,
      submittedEmail: row.submitted_email,
      submittedName: row.submitted_name,
      submittedEquipment: row.submitted_equipment,
      otherEquipmentDetail: response.otherEquipmentDetail,
      status: response.status,
      attempting: response.attempting,
      issue: response.issue,
      steps: response.steps,
    });
    // commitEvent uses optimistic concurrency and refreshes the read model on success,
    // so the next iteration's hasRowHash check sees this ticket. Commit one at a time.
    const resp = await deps.commitEvent(
      deps.sharedReadModel.getCurrentEventIndex()
    )(event)();
    if (E.isLeft(resp)) {
      deps.logger.warn(
        'Failed to commit TroubleTicketCreated for row hash %s: %o - skipping',
        rowHash,
        resp.left
      );
      continue;
    }
    created += 1;
  }

  if (created > 0) {
    deps.logger.info('Ingested %s new trouble ticket(s)', created);
  }
};
