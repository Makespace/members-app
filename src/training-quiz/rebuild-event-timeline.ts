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
//   - the whole rewrite is one atomic batch guarded by an in-batch drift check:
//     if any event or deletion lands between our read of the log and the batch
//     executing, the guard statement fails and the WHOLE batch rolls back with
//     nothing changed - a concurrent write can never be silently dropped;
//   - every column of every existing row is re-inserted verbatim - only
//     event_index changes;
//   - it refuses to run unless the existing log is already ordered by
//     recordedAt (renumbering must never reorder existing events);
//   - the events + deleted_events tables are backed up first (recoverable),
//     and it refuses to overwrite backups from a previous run - a human must
//     verify that run and drop the *_backup tables before another rewrite.
//     (The un-guarded CREATE TABLE inside the batch enforces this atomically;
//     the pre-check just gives a clearer error.)
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
    'SELECT id, event_index, event_type, payload, resource_version, resource_id, resource_type FROM events ORDER BY event_index ASC'
  );
  const rows = result.rows.map(row => {
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
      // Legacy columns the current append path never writes; carried through
      // verbatim so the rewrite is lossless whatever their values.
      resourceVersion: row.resource_version as number | null,
      resourceId: row.resource_id as string | null,
      resourceType: row.resource_type as string | null,
    };
  });

  // Fail loudly rather than silently mis-order the log: an unparseable
  // recordedAt would become NaN and corrupt the timestamp sort. This should
  // never happen (every event is built via constructEvent) but guards against
  // unknown legacy rows before we rewrite the source of truth.
  const undated = rows.filter(row => Number.isNaN(row.recordedAtMs));
  if (undated.length > 0) {
    const sample = undated
      .slice(0, 5)
      .map(row => `#${row.oldIndex} (${row.eventType})`)
      .join(', ');
    throw new Error(
      `Refusing to rebuild timeline: ${undated.length} event(s) have an unparseable recordedAt, e.g. ${sample}`
    );
  }

  // The planner sorts by recordedAt, which only preserves the existing events'
  // relative order if that order already agrees with their timestamps (ties are
  // fine - the sort is stable by old index). If the log violates this (e.g.
  // clock skew between deploys), a rewrite would silently REORDER existing
  // events and change what the read model computes on replay. Refuse and let a
  // human look, rather than papering over it.
  const misordered = rows.filter(
    (row, i) => i > 0 && row.recordedAtMs < rows[i - 1].recordedAtMs
  );
  if (misordered.length > 0) {
    const sample = misordered
      .slice(0, 5)
      .map(row => `#${row.oldIndex} (${row.eventType})`)
      .join(', ');
    throw new Error(
      `Refusing to rebuild timeline: ${misordered.length} event(s) have a recordedAt earlier than the event before them, e.g. ${sample}. The log must be in chronological order before it can be renumbered.`
    );
  }

  return rows;
};

// A previous rewrite's backups are the only in-database way back to the log as
// it was before that run. Never overwrite them mechanically: the operator must
// verify the previous run and DROP the *_backup tables to allow another one.
const assertNoPreviousBackup = async (eventDB: Client): Promise<void> => {
  const backups = await eventDB.execute(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('events_backup', 'deleted_events_backup')"
  );
  if (backups.rows.length > 0) {
    throw new Error(
      'Refusing to rebuild timeline: backup tables from a previous rewrite exist (events_backup / deleted_events_backup). Verify that run, then drop the backup tables to allow another rewrite.'
    );
  }
};

// First statement of the batch: succeeds as a no-op while the log still looks
// exactly like the snapshot we planned from, and deliberately violates the
// event_index NOT NULL constraint (failing the WHOLE batch atomically) if any
// event was appended or any deletion recorded in between. Appends always
// increase max(event_index) and deletions only ever add deleted_events rows, so
// these two checks cover every concurrent write the store supports.
const driftGuard = (
  expectedMaxIndex: number,
  expectedDeletedCount: number
): InStatement => ({
  sql: `INSERT INTO events (id, event_index, event_type, payload)
        SELECT 'drift-guard', NULL, 'drift-guard', 'drift-guard'
        WHERE (SELECT coalesce(max(event_index), 0) FROM events) <> ?
           OR (SELECT count(*) FROM deleted_events) <> ?`,
  args: [expectedMaxIndex, expectedDeletedCount],
});

const isDriftError = (error: unknown): boolean =>
  error instanceof Error && error.message.includes('events.event_index');

const isBackupCollision = (error: unknown): boolean =>
  error instanceof Error && error.message.includes('_backup');

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

    await assertNoPreviousBackup(eventDB);

    const deletedRows = (
      await eventDB.execute(
        'SELECT event_index, deleted_at_unix_ms, delete_reason, mark_deleted_by_member_number FROM deleted_events'
      )
    ).rows;

    const {rows, remap} = planTimelineRebuild(existing, inserts);
    const oldToNewIndex = new Map(remap.map(r => [r.oldIndex, r.newIndex]));

    const statements: InStatement[] = [
      // 0. Abort the whole batch if the log changed since we read it.
      driftGuard(
        existing.length > 0 ? existing[existing.length - 1].oldIndex : 0,
        deletedRows.length
      ),
      // 1. Back up both tables so the rewrite is recoverable. Deliberately no
      //    DROP IF EXISTS: colliding with a previous run's backup fails the
      //    batch instead of destroying the only way back to the original log.
      'CREATE TABLE events_backup AS SELECT * FROM events',
      'CREATE TABLE deleted_events_backup AS SELECT * FROM deleted_events',
      // 2. Clear deleted_events before events so the foreign key never dangles.
      'DELETE FROM deleted_events',
      'DELETE FROM events',
      // 3. Re-insert every event, every column, in the new chronological order.
      ...rows.map(row => ({
        sql: 'INSERT INTO events (id, event_index, event_type, payload, resource_version, resource_id, resource_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
        args: [
          row.id,
          row.newIndex,
          row.eventType,
          row.payload,
          row.resourceVersion ?? null,
          row.resourceId ?? null,
          row.resourceType ?? null,
        ],
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

    try {
      await eventDB.batch(statements, 'write');
    } catch (error) {
      if (isDriftError(error)) {
        throw new Error(
          'Timeline rebuild aborted: an event or deletion was committed while the rewrite was being planned. Nothing was changed - re-run to try again.'
        );
      }
      if (isBackupCollision(error)) {
        throw new Error(
          'Refusing to rebuild timeline: backup tables from a previous rewrite exist (events_backup / deleted_events_backup). Verify that run, then drop the backup tables to allow another rewrite.'
        );
      }
      throw error;
    }

    await resetReadModel();

    return {
      rewrote: true,
      inserted: inserts.length,
      totalBefore: existing.length,
      totalAfter: rows.length,
    };
  };
