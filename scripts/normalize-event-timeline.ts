#!/usr/bin/env bun
/**
 * ONE-TIME migration: put the event log in chronological order, so the
 * training-quiz backfill can weave events at their historical position.
 *
 * Two operations, both verified lossless (see --dry-run replay diff):
 *   1. Shift the whole "setup era" (block 1 - every event before the FIRST time
 *      seam) back in time so it predates the historical training import.
 *      Anchored to 2013 (Makespace's founding year); only the year changes,
 *      month/day/time/milliseconds are preserved.
 *   2. Delete block 2 - the segment between the first and second seam, verified
 *      to be a byte-identical duplicate of the training import that follows it.
 *
 * Result: no recordedAt ever steps backwards (0 seams).
 *
 * Usage (connects to whatever TURSO_EVENTDB_SYNC_URL points at):
 *   TURSO_EVENTDB_SYNC_URL=... TURSO_TOKEN=... bun scripts/normalize-event-timeline.ts            # dry-run
 *   TURSO_EVENTDB_SYNC_URL=... TURSO_TOKEN=... bun scripts/normalize-event-timeline.ts --apply
 *
 * ALWAYS run the dry-run first and review the read-model diff. Take a Turso
 * point-in-time backup before --apply. Run in a quiet window.
 */
import * as libsqlClient from '@libsql/client';
import {Client, InStatement} from '@libsql/client';
import type Database from 'better-sqlite3';
import {pipe} from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';
import pino from 'pino';
import {getAllEventsAfterEventIndex} from '../src/init-dependencies/event-store/get-all-events';
import {initSharedReadModel} from '../src/read-models/shared-state';
import {StoredDomainEvent} from '../src/types';

const ANCHOR_YEAR = 2013;
const silent = pino({level: 'silent'});

// Fields that differ between two byte-identical events - excluded so the rest
// of the payload forms the identity key (matches the /event-log-order page).
const DUP_EXCLUDED = new Set([
  'event_index',
  'event_id',
  'deletedAt',
  'deleteReason',
  'markDeletedByMemberNumber',
]);
const dupKey = (event: StoredDomainEvent): string => {
  const record = event as unknown as Record<string, unknown>;
  const canonical: Record<string, unknown> = {};
  for (const key of Object.keys(record).sort()) {
    if (!DUP_EXCLUDED.has(key)) canonical[key] = record[key];
  }
  return JSON.stringify(canonical);
};

const die = (message: string): never => {
  console.error(`\nABORT: ${message}`);
  process.exit(1);
};

const loadEvents = (client: Client): Promise<ReadonlyArray<StoredDomainEvent>> =>
  pipe(
    getAllEventsAfterEventIndex(client)(0),
    TE.getOrElse((failure): never => die(`could not read events: ${failure.message}`)),
  )();

type Structure = {
  block2FirstIndex: number; // first event_index of block 2 (inclusive)
  block2LastIndex: number; // last event_index of block 2 (inclusive)
  block3FirstIndex: number; // first event_index after block 2
  shiftYears: number;
};

// Re-derive the block boundaries FROM the data rather than hard-coding them, and
// assert the structure is the one this migration was designed for.
const detectStructure = (
  events: ReadonlyArray<StoredDomainEvent>
): Structure => {
  const ms = events.map(e => e.recordedAt.getTime());
  const seams: number[] = [];
  for (let i = 1; i < events.length; i++) {
    if (ms[i] < ms[i - 1]) seams.push(i);
  }
  if (seams.length !== 2) {
    die(
      `expected exactly 2 time seams (setup->import, import->import), found ${seams.length}. ` +
        `The log is not in the shape this migration was designed for - review manually.`
    );
  }
  const [p1, p2] = seams;
  const block2FirstIndex = events[p1].event_index;
  const block2LastIndex = events[p2 - 1].event_index;
  const block3FirstIndex = events[p2].event_index;

  // Duplicate check: every block-2 event must be byte-identical to one at or
  // after block 3 (i.e. block 2 is a redundant re-import).
  const keyToIndexes = new Map<string, number[]>();
  events.forEach(e => {
    const k = dupKey(e);
    const b = keyToIndexes.get(k);
    if (b) b.push(e.event_index);
    else keyToIndexes.set(k, [e.event_index]);
  });
  const block2 = events.slice(p1, p2);
  const notDuplicated = block2.filter(e => {
    const twins = keyToIndexes.get(dupKey(e)) ?? [];
    return !twins.some(idx => idx >= block3FirstIndex);
  });
  if (notDuplicated.length > 0) {
    die(
      `block 2 (event_index ${block2FirstIndex}..${block2LastIndex}) is NOT fully ` +
        `duplicated in the following import: ${notDuplicated.length} of ${block2.length} ` +
        `events have no twin. Deleting it would lose data - review manually.`
    );
  }

  // Block 2 is deleted by event_index RANGE (on the raw table) in apply().
  // getAllEvents filters out EquipmentTrainingQuizResult rows, so if any sat
  // inside block 2's index range they would be deleted without showing in the
  // (also filtered) dry-run diff. Refuse unless the range is gap-free - i.e. it
  // holds exactly the block-2 events we analysed and nothing else.
  if (block2LastIndex - block2FirstIndex + 1 !== block2.length) {
    die(
      `block 2's event_index range (${block2FirstIndex}..${block2LastIndex}) is not ` +
        `contiguous: ${block2.length} events span ${block2LastIndex - block2FirstIndex + 1} ` +
        `indices, so deleting the range would also remove other rows. Review manually.`
    );
  }

  // Shift so block 1 lands in ANCHOR_YEAR, and assert it then fully predates the
  // training import (no overlap).
  const block1 = events.slice(0, p1);
  const shiftYears = block1[0].recordedAt.getUTCFullYear() - ANCHOR_YEAR;
  if (shiftYears <= 0) {
    die(`block 1 already starts at or before ${ANCHOR_YEAR}; nothing to shift (already applied?).`);
  }
  const block1MaxAfter = new Date(block1[block1.length - 1].recordedAt);
  block1MaxAfter.setUTCFullYear(block1MaxAfter.getUTCFullYear() - shiftYears);
  const block3Min = events[p2].recordedAt.getTime();
  if (block1MaxAfter.getTime() >= block3Min) {
    die(
      `after a ${shiftYears}-year shift, block 1 would still overlap the training import ` +
        `(${block1MaxAfter.toISOString()} >= ${events[p2].recordedAt.toISOString()}).`
    );
  }
  return {block2FirstIndex, block2LastIndex, block3FirstIndex, shiftYears};
};

// Apply the transform to an in-memory copy of the decoded events: shift block 1's
// recordedAt, drop block 2. Used for the dry-run replay diff.
const transformInMemory = (
  events: ReadonlyArray<StoredDomainEvent>,
  s: Structure
): StoredDomainEvent[] =>
  events
    .filter(
      e =>
        !(e.event_index >= s.block2FirstIndex && e.event_index <= s.block2LastIndex)
    )
    .map(e => {
      if (e.event_index >= s.block2FirstIndex) return e;
      const shifted = new Date(e.recordedAt);
      shifted.setUTCFullYear(shifted.getUTCFullYear() - s.shiftYears);
      return {...e, recordedAt: shifted};
    });

const buildReadModel = (client: Client, events: ReadonlyArray<StoredDomainEvent>) => {
  const rm = initSharedReadModel(client, silent);
  events.forEach(rm.updateState);
  return rm._underlyingReadModelDb;
};

const rowCount = (db: Database.Database, table: string): number =>
  (db.prepare(`SELECT count(*) c FROM "${table}"`).get() as {c: number}).c;

const trainedSet = (db: Database.Database): Map<string, number> =>
  new Map(
    (
      db
        .prepare('SELECT memberNumber, equipmentId, trainedAt FROM trainedMembers')
        .all() as {memberNumber: number; equipmentId: string; trainedAt: number}[]
    ).map(r => [`${r.memberNumber}|${r.equipmentId}`, r.trainedAt])
  );

const dryRun = async (
  client: Client,
  events: ReadonlyArray<StoredDomainEvent>,
  s: Structure
) => {
  console.log(`\n=== PLAN (dry-run - nothing written) ===`);
  console.log(`  shift block 1 (event_index < ${s.block2FirstIndex}) back ${s.shiftYears} years -> ${ANCHOR_YEAR}`);
  console.log(`  delete block 2 (event_index ${s.block2FirstIndex}..${s.block2LastIndex}), verified duplicate of the import at >= ${s.block3FirstIndex}`);

  const before = buildReadModel(client, events);
  const after = buildReadModel(client, transformInMemory(events, s));

  console.log(`\n=== read-model diff (before -> after) ===`);
  const tables = (before.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as {name: string}[]).map(r => r.name);
  let anyStructuralChange = false;
  for (const t of tables) {
    const a = rowCount(before, t);
    const b = rowCount(after, t);
    if (a !== b) {
      console.log(`  ${t.padEnd(30)} ${a} -> ${b}   (${b - a > 0 ? '+' : ''}${b - a})`);
      if (t !== 'failedEventsTable') anyStructuralChange = true;
    }
  }
  if (!anyStructuralChange) console.log(`  (all tables except failedEventsTable have identical row counts)`);

  const ta = trainedSet(before);
  const tb = trainedSet(after);
  let missing = 0, extra = 0, dateChanged = 0;
  for (const [k, v] of ta) { if (!tb.has(k)) missing++; else if (tb.get(k) !== v) dateChanged++; }
  for (const k of tb.keys()) if (!ta.has(k)) extra++;
  console.log(`\n  trainedMembers: ${ta.size} -> ${tb.size}; MISSING ${missing}, EXTRA ${extra}, trained-since-date-changed ${dateChanged}`);
  if (missing > 0 || extra > 0) die(`training records would be lost or invented - DO NOT APPLY.`);

  // chronological check on the transformed set (index order)
  const transformed = transformInMemory(events, s);
  let seams = 0;
  for (let i = 1; i < transformed.length; i++) {
    if (transformed[i].recordedAt.getTime() < transformed[i - 1].recordedAt.getTime()) seams++;
  }
  console.log(`  result chronological: ${seams === 0 ? 'YES (0 seams)' : `NO (${seams} seams remain)`}`);
  console.log(`\nDry-run OK. Review the diff above, then re-run with --apply (after a Turso backup).`);
};

const apply = async (
  client: Client,
  events: ReadonlyArray<StoredDomainEvent>,
  s: Structure
) => {
  // Guard against double-apply.
  if (events[0].recordedAt.getUTCFullYear() < 2020) {
    die(`event 1 is already dated ${events[0].recordedAt.toISOString()} - looks already applied.`);
  }
  console.log(`\n=== APPLY ===`);

  // 1. Backup (belt-and-suspenders on top of the Turso point-in-time backup).
  await client.execute('DROP TABLE IF EXISTS events_prenormalize_backup');
  await client.execute('DROP TABLE IF EXISTS deleted_events_prenormalize_backup');
  await client.execute('CREATE TABLE events_prenormalize_backup AS SELECT * FROM events');
  await client.execute('CREATE TABLE deleted_events_prenormalize_backup AS SELECT * FROM deleted_events');
  console.log(`  backed up events/deleted_events to *_prenormalize_backup`);

  // The whole change is 3 statements in one atomic batch (no huge multi-row
  // request against remote Turso):
  //
  //  - Shift ONLY the payload's recordedAt (not other date fields like
  //    OwnerAgreementSigned.signedAt - those are left as-is; the read model was
  //    verified unchanged by that, and the dry-run diff mirrors this).
  //  - Shift it back `shiftYears` years by string arithmetic on the ISO year:
  //    replace the first 4 chars (YYYY) with YYYY-shiftYears and keep the rest
  //    (-MM-DDTHH:MM:SS.sssZ). This preserves milliseconds - SQL datetime() would
  //    truncate them, making block 1 look like a whole-second import.
  //  - The `recordedAt IS NOT NULL` guard skips any payload without one (e.g. the
  //    obsolete EquipmentTrainingQuizResult rows).
  const statements: InStatement[] = [
    {
      // The outer CAST keeps the year an INTEGER: libsql binds the JS `shiftYears`
      // as a REAL, so 2024 - 11.0 = 2013.0, which would stringify as "2013.0" and
      // corrupt the ISO date. CAST(... AS INTEGER) makes it "2013".
      sql: `UPDATE events
            SET payload = json_set(payload, '$.recordedAt',
              CAST(CAST(substr(json_extract(payload, '$.recordedAt'), 1, 4) AS INTEGER) - ? AS INTEGER)
              || substr(json_extract(payload, '$.recordedAt'), 5))
            WHERE event_index < ?
              AND json_extract(payload, '$.recordedAt') IS NOT NULL`,
      args: [s.shiftYears, s.block2FirstIndex],
    },
    // Delete block 2 (+ any deletion rows pointing into it); its index range is
    // asserted gap-free in detectStructure, so this removes exactly block 2.
    {
      sql: 'DELETE FROM deleted_events WHERE event_index BETWEEN ? AND ?',
      args: [s.block2FirstIndex, s.block2LastIndex],
    },
    {
      sql: 'DELETE FROM events WHERE event_index BETWEEN ? AND ?',
      args: [s.block2FirstIndex, s.block2LastIndex],
    },
  ];

  await client.batch(statements, 'write');
  console.log(
    `  shifted block 1 back ${s.shiftYears} years, deleted block 2 (event_index ${s.block2FirstIndex}..${s.block2LastIndex})`
  );

  // 4. Post-conditions.
  const after = await loadEvents(client);
  let seams = 0;
  for (let i = 1; i < after.length; i++) {
    if (after[i].recordedAt.getTime() < after[i - 1].recordedAt.getTime()) seams++;
  }
  const dangling = Number((await client.execute('SELECT count(*) c FROM deleted_events d LEFT JOIN events e ON e.event_index=d.event_index WHERE e.event_index IS NULL')).rows[0].c);
  const stillBlock2 = Number((await client.execute({sql: 'SELECT count(*) c FROM events WHERE event_index BETWEEN ? AND ?', args: [s.block2FirstIndex, s.block2LastIndex]})).rows[0].c);
  console.log(`\n  post-check: seams=${seams}, dangling deleted_events=${dangling}, block-2 events remaining=${stillBlock2}`);
  if (seams !== 0 || dangling !== 0 || stillBlock2 !== 0) {
    die(`post-conditions FAILED - restore from events_prenormalize_backup or the Turso snapshot.`);
  }
  console.log(`\nAPPLIED. Restart the app so the read model rebuilds, verify, then run the quiz backfill.`);
  console.log(`(Backup tables events_prenormalize_backup / deleted_events_prenormalize_backup remain until you drop them.)`);
};

const main = async () => {
  const url = process.env.TURSO_EVENTDB_SYNC_URL;
  if (!url) die('set TURSO_EVENTDB_SYNC_URL (and TURSO_TOKEN for a remote libsql url).');
  const client = libsqlClient.createClient({url: url!, authToken: process.env.TURSO_TOKEN});

  const events = await loadEvents(client);
  console.log(`loaded ${events.length} events; first recordedAt ${events[0]?.recordedAt.toISOString()}`);
  const structure = detectStructure(events);

  if (process.argv.includes('--apply')) {
    await apply(client, events, structure);
  } else {
    await dryRun(client, events, structure);
  }
  process.exit(0);
};

main().catch(e => die(e instanceof Error ? e.stack ?? e.message : String(e)));
