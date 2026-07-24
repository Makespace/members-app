import {Client, InStatement} from '@libsql/client';
import {
  ExistingRow,
  TimelineRow,
  planTimelineRebuild,
} from './plan-timeline-rebuild';

// The one-time, destructive operation that weaves a batch of historical events
// into the correct chronological position in the append-only log.
//
// This is the ONLY thing that ever renumbers event_index. It is safe because it
// is a controlled, one-off catch-up rather than something on the hot path:
//   - the whole log is rewritten in one atomic batch (all-or-nothing);
//   - the events + deleted_events tables are backed up first (recoverable);
//   - deleted_events indices are re-pointed via the old->new map, so the only
//     source-of-truth reference to an index stays correct;
//   - the read model is then reset() and rebuilt from the new order.
// Everything else that references an index lives in the (rebuildable) read model.

export type TimelineRebuildSummary = {
  rewrote: boolean;
  inserted: number;
  totalBefore: number;
  totalAfter: number;
};

const readExistingRows = async (eventDB: Client): Promise<ExistingRow[]> => {
  const result = await eventDB.execute(
    'SELECT id, event_index, event_type, payload FROM events ORDER BY event_index ASC'
  );
  return result.rows.map(row => {
    // These are known TEXT/INTEGER columns; libsql types them as a Value union.
    const payload = row.payload as string;
    // Every event carries recordedAt in its payload as an ISO string; that is
    // the timestamp the log is ordered by.
    const recordedAt = (JSON.parse(payload) as {recordedAt: string}).recordedAt;
    return {
      id: row.id as string,
      eventType: row.event_type as string,
      payload,
      recordedAtMs: Date.parse(recordedAt),
      oldIndex: Number(row.event_index),
    };
  });
};

export const rebuildEventTimeline =
  (eventDB: Client, resetReadModel: () => Promise<void>) =>
  async (
    inserts: ReadonlyArray<TimelineRow>
  ): Promise<TimelineRebuildSummary> => {
    const existing = await readExistingRows(eventDB);

    // Nothing new to weave in => leave the source of truth completely untouched.
    if (inserts.length === 0) {
      return {
        rewrote: false,
        inserted: 0,
        totalBefore: existing.length,
        totalAfter: existing.length,
      };
    }

    const deletedRows = (
      await eventDB.execute(
        'SELECT event_index, deleted_at_unix_ms, delete_reason, mark_deleted_by_member_number FROM deleted_events'
      )
    ).rows;

    const {rows, remap} = planTimelineRebuild(existing, inserts);
    const oldToNewIndex = new Map(remap.map(r => [r.oldIndex, r.newIndex]));

    const statements: InStatement[] = [
      // 1. Back up both tables so the rewrite is recoverable.
      'DROP TABLE IF EXISTS events_backup',
      'CREATE TABLE events_backup AS SELECT * FROM events',
      'DROP TABLE IF EXISTS deleted_events_backup',
      'CREATE TABLE deleted_events_backup AS SELECT * FROM deleted_events',
      // 2. Clear deleted_events before events so the foreign key never dangles.
      'DELETE FROM deleted_events',
      'DELETE FROM events',
      // 3. Re-insert every event in the new chronological order.
      ...rows.map(row => ({
        sql: 'INSERT INTO events (id, event_index, event_type, payload) VALUES (?, ?, ?, ?)',
        args: [row.id, row.newIndex, row.eventType, row.payload],
      })),
      // 4. Re-point deletions at their events' new indices.
      ...deletedRows.map(deleted => ({
        sql: 'INSERT INTO deleted_events (event_index, deleted_at_unix_ms, delete_reason, mark_deleted_by_member_number) VALUES (?, ?, ?, ?)',
        args: [
          oldToNewIndex.get(Number(deleted.event_index)) ??
            Number(deleted.event_index),
          deleted.deleted_at_unix_ms,
          deleted.delete_reason,
          deleted.mark_deleted_by_member_number,
        ],
      })),
    ];

    await eventDB.batch(statements, 'write');
    await resetReadModel();

    return {
      rewrote: true,
      inserted: inserts.length,
      totalBefore: existing.length,
      totalAfter: rows.length,
    };
  };
