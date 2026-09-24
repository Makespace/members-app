import * as O from 'fp-ts/Option';
import {ExternalStateDB} from '../../sync-worker/external-state-db';
import {guideLinkCheckTable} from '../../sync-worker/guide-links/guide-link-table';

// What the nightly check found when it last fetched each recorded equipment
// guide. Absent for a link recorded since the last run - which reads as "not
// checked yet" rather than as a problem.
export type GuideLinkCheck = {
  url: string;
  status: O.Option<number>;
  reachable: boolean;
  checkedAt: Date;
};

export const getGuideLinkChecks =
  (extDB: ExternalStateDB) =>
  async (): Promise<ReadonlyMap<string, GuideLinkCheck>> => {
    const rows = await extDB.select().from(guideLinkCheckTable).all();
    return new Map(
      rows.map(row => [
        row.equipmentId,
        {
          url: row.url,
          status: O.fromNullable(row.status),
          reachable: row.reachable,
          checkedAt: row.checkedAt,
        },
      ])
    );
  };
