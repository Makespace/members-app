#!/usr/bin/env npx tsx
import {createClient} from '@libsql/client';

// READ-ONLY pre-flight for the one-time training-quiz timeline backfill
// (docs/training-quiz-migration.md). The backfill refuses to run if the
// existing log violates its preconditions; this script runs the same checks
// without touching anything, so surprises surface before the maintenance
// window, not during it.
//
// Checks every event row for:
//   1. a parseable recordedAt in the payload (the timestamp the log is
//      ordered by);
//   2. chronological order: recordedAt must never decrease as event_index
//      increases (renumbering must never reorder existing events);
//   3. leftover events_backup / deleted_events_backup tables from a previous
//      rewrite (the backfill refuses to overwrite them).
// It also reports any rows with non-null legacy resource_* columns - the
// rewrite preserves them, but it's worth knowing they exist.
//
// Usage (against prod, read-only):
//   TURSO_EVENTDB_SYNC_URL=libsql://... TURSO_TOKEN=... \
//     npx tsx scripts/check-event-chronology.ts
// Or against a local file:
//   TURSO_EVENTDB_SYNC_URL=file:/db/makespace-member-app.db npx tsx scripts/check-event-chronology.ts

const url = process.env.TURSO_EVENTDB_SYNC_URL;
if (!url) {
  console.error('Set TURSO_EVENTDB_SYNC_URL (and TURSO_TOKEN for remote).');
  process.exit(1);
}

const main = async () => {
  const client = createClient({
    url,
    authToken: process.env.TURSO_TOKEN,
  });

  const result = await client.execute(
    'SELECT event_index, event_type, payload, resource_version, resource_id, resource_type FROM events ORDER BY event_index ASC'
  );

  let unparseable = 0;
  let misordered = 0;
  let withResourceColumns = 0;
  let previousMs = Number.NEGATIVE_INFINITY;
  let previousIndex = 0;

  for (const row of result.rows) {
    const index = Number(row.event_index);
    const eventType = row.event_type as string;
    let recordedAtMs = NaN;
    try {
      const payload = JSON.parse(row.payload as string) as {
        recordedAt?: string;
      };
      recordedAtMs = Date.parse(payload.recordedAt ?? '');
    } catch {
      // fall through: counted as unparseable
    }

    if (Number.isNaN(recordedAtMs)) {
      unparseable++;
      console.log(`UNPARSEABLE  #${index} (${eventType}): no usable recordedAt`);
      continue;
    }
    if (recordedAtMs < previousMs) {
      misordered++;
      console.log(
        `OUT-OF-ORDER #${index} (${eventType}): recordedAt ${new Date(recordedAtMs).toISOString()} precedes #${previousIndex}'s ${new Date(previousMs).toISOString()}`
      );
    }
    if (
      row.resource_version !== null ||
      row.resource_id !== null ||
      row.resource_type !== null
    ) {
      withResourceColumns++;
    }
    previousMs = recordedAtMs;
    previousIndex = index;
  }

  const backups = await client.execute(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('events_backup', 'deleted_events_backup')"
  );
  for (const row of backups.rows) {
    console.log(`LEFTOVER BACKUP TABLE: ${row.name as string}`);
  }

  console.log(
    `\nChecked ${result.rows.length} events: ${unparseable} unparseable recordedAt, ${misordered} out of chronological order, ${withResourceColumns} with legacy resource_* values, ${backups.rows.length} leftover backup table(s).`
  );
  const blockers = unparseable + misordered + backups.rows.length;
  console.log(
    blockers === 0
      ? 'OK: the timeline backfill preconditions are satisfied.'
      : 'BLOCKED: the timeline backfill would refuse to run - investigate the lines above.'
  );
  process.exit(blockers === 0 ? 0 : 2);
};

main().catch(e => {
  console.error(e);
  process.exit(1);
});
