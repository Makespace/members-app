import * as t from 'io-ts';
import * as tt from 'io-ts-types';

export const CachedDataTable = t.strict({
  rows: t.readonlyArray(
    t.strict({
      cached_at: tt.DateFromNumber,
      sheet_id: t.string,
      last_row_read: tt.withFallback(t.string, '{}'),
      cached_data: t.string,
    })
  ),
});
export type CachedDataTable = t.TypeOf<typeof CachedDataTable>;
