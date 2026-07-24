import {constructEvent} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {Command} from '../command';
import {isAdminOrSuperUser} from '../authentication-helpers/is-admin-or-super-user';
import {troubleTicketRowHash} from '../../trouble-tickets/row-hash';

// Creates a trouble ticket directly (admin/super user). Ongoing tickets normally arrive
// via the sync-worker ingest from the Google Form; this command exists for seeding local
// dev data and for future manual entry. Generates the dedup rowHash from the supplied
// fields so re-running a seed is idempotent.
const codec = t.strict({
  id: tt.UUID,
  submittedEquipment: t.union([t.string, t.null]),
  submittedMemberNumber: t.union([tt.NumberFromString, t.null]),
  submittedEmail: t.union([t.string, t.null]),
  submittedName: t.union([t.string, t.null]),
  otherEquipmentDetail: t.string,
  status: t.string,
  attempting: t.string,
  issue: t.string,
  steps: t.string,
});

type CreateTroubleTicket = t.TypeOf<typeof codec>;

const SEED_SHEET_ID = 'manual';

const process: Command<CreateTroubleTicket>['process'] = input => {
  const submittedAt = new Date();
  const responseJson = JSON.stringify({
    otherEquipmentDetail: input.command.otherEquipmentDetail,
    status: input.command.status,
    attempting: input.command.attempting,
    issue: input.command.issue,
    steps: input.command.steps,
  });
  const rowHash = troubleTicketRowHash({
    sheetId: SEED_SHEET_ID,
    submittedAt,
    submittedEmail: input.command.submittedEmail,
    submittedMemberNumber: input.command.submittedMemberNumber,
    submittedEquipment: input.command.submittedEquipment,
    responseJson,
  });
  return TE.right(
    input.rm.troubleTickets.hasRowHash(rowHash)
      ? O.none
      : O.some(
          constructEvent('TroubleTicketCreated')({
            id: input.command.id,
            rowHash,
            sheetId: SEED_SHEET_ID,
            submittedAt,
            submittedMemberNumber: input.command.submittedMemberNumber,
            submittedEmail: input.command.submittedEmail,
            submittedName: input.command.submittedName,
            submittedEquipment: input.command.submittedEquipment,
            otherEquipmentDetail: input.command.otherEquipmentDetail,
            status: input.command.status,
            attempting: input.command.attempting,
            issue: input.command.issue,
            steps: input.command.steps,
            actor: input.command.actor,
          })
        )
  );
};

export const create: Command<CreateTroubleTicket> = {
  process,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
