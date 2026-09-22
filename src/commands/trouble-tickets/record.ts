import {constructEvent} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {Command} from '../command';
import {isAdminSuperUserOrSystem} from '../authentication-helpers/is-admin-super-user-or-system';

// rowHash is the global dedup sentinel (and unique in the read model), so it
// must never be empty; the member number must be a real integer (t.number would
// let NaN through). The submitter-provided identity fields stay free-form: the
// sheet fields are unvalidated.
const codec = t.strict({
  id: tt.UUID,
  rowHash: tt.NonEmptyString,
  sheetId: tt.NonEmptyString,
  submittedAt: tt.DateFromISOString,
  submittedMemberNumber: t.union([t.Int, t.null]),
  submittedEmail: t.union([t.string, t.null]),
  submittedName: t.union([t.string, t.null]),
  submittedEquipment: t.union([t.string, t.null]),
  otherEquipmentDetail: t.string,
  status: t.string,
  attempting: t.string,
  issue: t.string,
  steps: t.string,
});

type RecordTroubleTicket = t.TypeOf<typeof codec>;

// Records one trouble-ticket submission as an event, unless a row with the same
// hash has already been imported (dedup). Stores only the raw sheet facts - no
// member or equipment resolution.
const process: Command<RecordTroubleTicket>['process'] = input =>
  TE.right(
    input.rm.troubleTickets.hasRowHash(input.command.rowHash)
      ? O.none
      : O.some(
          constructEvent('TroubleTicketCreated')({
            ...input.command,
            // Imported from the sheet: no picked equipment, no confirmation
            // email.
            source: 'sheet',
            equipmentId: null,
            machine: '',
          })
        )
  );

export const record: Command<RecordTroubleTicket> = {
  process,
  decode: codec.decode,
  isAuthorized: isAdminSuperUserOrSystem,
};
