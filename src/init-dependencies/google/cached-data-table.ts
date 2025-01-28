import * as t from 'io-ts';
import * as tt from 'io-ts-types';

export const CachedDataTable = t.strict({
  rows: t.readonlyArray(
    t.strict({
      cache_entry_id: t.string,
      cached_timestamp: tt.DateFromNumber,
      sheet_id: t.string,
      equipment_id: t.string,
      cached_data: t.string,
    })
  ),
});
export type CachedDataTable = t.TypeOf<typeof CachedDataTable>;
