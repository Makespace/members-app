# Normalising the event timeline (prerequisite for the quiz migration)

The event log is **not** in chronological order: the 2024 app-setup import stamped
every member/equipment/area creation with its import-run date (2024-07/08), while
the historical training was imported with its real 2020–2024 dates. So a
`recordedAt` sort would place training years before the members/equipment it
depends on. This one-time migration puts the log in true chronological order, so
the training-quiz backfill can then weave quiz events at their historical
position (its order guard requires a chronologically-ordered log).

See `docs/event-log-ordering-investigation.md` for the full analysis, and the
super-user page **`/event-log-order`** to visualise the blocks/seams on live data.

## What it does (two operations, verified lossless)

1. **Shift the setup era back in time.** Everything before the first *time seam*
   (the "block 1" 2024 setup era — member registry, equipment, areas, trainers)
   is shifted back so it lands in **2013** (Makespace's founding year). Only the
   year changes; month/day/time/milliseconds are preserved. This puts every
   creation/prerequisite *before* the 2020 historical training that depends on it.
2. **Delete the duplicate training import.** The segment between the first and
   second seam ("block 2") is a **byte-identical duplicate** of the training
   import that immediately follows it (a stale earlier partial import). It is
   deleted; every record survives in the fuller import.

Result: `recordedAt` never steps backwards (0 seams). Whole thing verified by a
before/after read-model replay diff:

- **`trainedMembers` identical** (same 2,553 member↔equipment pairs; 0 lost, 0 invented).
- **members / equipment / areas / owners / trainers / emails: identical row counts.**
- **`failedEventsTable`: fewer** (the 18 removed are duplicate orphan-training
  failures that lived in the deleted block; no new failures).
- Referential integrity preserved (no dangling `deleted_events`, no duplicate
  `event_index`).

### Changes to accept (correct by design, but visible)

- **"Member since" / "owner since" / "trainer since" dates for the founding
  cohort become 2013** instead of 2024. Arguably more truthful, but it is a
  user-visible date change.
- **5 members' "trained since" date** shifts to the surviving import's value
  (from deleting the duplicate). Trained *status* is unchanged.

## The tool

`scripts/normalize-event-timeline.ts` — connects to whatever
`TURSO_EVENTDB_SYNC_URL` points at, and is **self-verifying**: it re-derives the
block boundaries from the data (does not hard-code them), **asserts block 2 is
fully duplicated** before deleting anything, and refuses to run if the log is not
in the expected shape (e.g. already normalised, or an unexpected number of seams).

- **Dry-run (default, writes nothing):** prints the plan and a full read-model
  diff (before vs after). Review it.
- **`--apply`:** backs up `events`/`deleted_events` to `*_prenormalize_backup`
  tables, then shifts + deletes in one atomic batch, then checks post-conditions
  (0 seams, no dangling refs, block 2 gone) and aborts if any fail.

The shift is done in JS (not SQL `datetime()`) to preserve milliseconds —
otherwise block-1 timestamps truncate to whole seconds and start to look like an
import.

## Runbook (prod)

1. **Take a Turso point-in-time backup** / note the restore timestamp. This is
   the real safety net (the in-DB `*_prenormalize_backup` tables are a convenience
   on top).
2. **Dry-run** and review the diff:
   ```
   TURSO_EVENTDB_SYNC_URL=<prod-url> TURSO_TOKEN=<prod-token> \
     bun scripts/normalize-event-timeline.ts
   ```
   Confirm: only `failedEventsTable` changes count, `trainedMembers` MISSING/EXTRA
   are 0, and "result chronological: YES".
3. Pick a **quiet window** (minimal write traffic).
4. **Apply:**
   ```
   TURSO_EVENTDB_SYNC_URL=<prod-url> TURSO_TOKEN=<prod-token> \
     bun scripts/normalize-event-timeline.ts --apply
   ```
   Watch the post-condition line (`seams=0, dangling deleted_events=0,
   block-2 events remaining=0`).
5. **Restart the app** so the read model rebuilds from the new log. Spot-check a
   member page, an equipment page, and `/event-log-order` (should now show a
   single rising line, 0 seams).
6. **Then run the training-quiz backfill** (`POST /api/training-quiz/backfill-timeline`)
   — its order guard now passes, so it can weave quiz completions at their
   historical position. See `docs/training-quiz-migration.md`.

## Rollback

If anything looks wrong: **restore from the Turso point-in-time backup** (step 1)
and restart. Or, in-DB:
```sql
DELETE FROM deleted_events; DELETE FROM events;
INSERT INTO events SELECT * FROM events_prenormalize_backup;
INSERT INTO deleted_events SELECT * FROM deleted_events_prenormalize_backup;
```
(delete `deleted_events` first to satisfy the foreign key), then restart. Drop the
`*_prenormalize_backup` tables once you're satisfied.
