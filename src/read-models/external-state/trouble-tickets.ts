import {pipe} from 'fp-ts/lib/function';
import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {desc} from 'drizzle-orm';
import * as RA from 'fp-ts/ReadonlyArray';
import * as O from 'fp-ts/Option';
import {troubleTicketResponsesTable} from '../shared-state/state';
import {TroubleTicket} from '../shared-state/return-types';

const transformRow = <
  R extends {
    responseSubmitted: Date;
    emailAddress: string | null;
    whichEquipment: string | null;
    submitterName: string | null;
    submitterMembershipNumber: number | null;
    submittedResponse: unknown;
  },
>(
  row: R
) => ({
  ...row,
  emailAddress: O.fromNullable(row.emailAddress),
  whichEquipment: O.fromNullable(row.whichEquipment),
  submitterName: O.fromNullable(row.submitterName),
  submitterMembershipNumber: O.fromNullable(row.submitterMembershipNumber),
});

export const getAllTroubleTicketFull =
  (db: BetterSQLite3Database) => (): ReadonlyArray<TroubleTicket> =>
    pipe(
      db
        .select()
        .from(troubleTicketResponsesTable)
        .orderBy(desc(troubleTicketResponsesTable.responseSubmitted))
        .all(),
      RA.map(transformRow)
    );
