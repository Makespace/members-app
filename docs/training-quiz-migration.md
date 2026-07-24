# Training-quiz → event timeline migration

Moves historical training-quiz completions out of the rate-limited Google
Sheets cache and into the append-only event log, so Makespace keeps a complete,
portable record of every quiz ever passed. This doc is the concrete runbook for
Paul & James to land the code and run the one-time migration on prod.

## What ships (three stacked PRs — merge bottom-up)

Each PR's base is the one below it; GitHub auto-retargets to `main` as the parent
merges, and each merge auto-deploys to Fly.

1. **#274** – read-only `/training-event-log` dry-run page (preview of what would
   be created).
2. **#275** – the `TrainingQuizCompleted` event, the `RecordTrainingQuizCompletion`
   command (dedup by row hash), the read-model projection, and the append path
   (`POST /api/training-quiz/migrate`). This is the **going-forward** mechanism.
3. **#276** – the **one-time historical catch-up**: weaves cached quiz rows into
   the log at the point in time they actually happened, renumbering `event_index`
   so replay order stays chronological. Exposed as
   `POST /api/training-quiz/backfill-timeline`.

> Only **#276** rewrites history, and only once. Going forward, completions are
> appended normally (they are always newer than the tail), so the timeline
> surgery never runs again.

## Before you run it — read this

The backfill **rewrites the whole `events` table in one atomic batch**: it backs
up `events`/`deleted_events` to `*_backup` tables, re-inserts every event in
chronological order with fresh `event_index` values, re-points the
`deleted_events` foreign key, then rebuilds the read model. It is idempotent
(nothing new to insert ⇒ it does not touch the log) and refuses to run if any
existing event has an unparseable `recordedAt`.

Two things about prod make care necessary:

- **Prod is a single `app` process** that refreshes the read model every 10s and
  runs background sync workers that commit events. A rewrite running *while those
  are active* can drop an event committed during the rewrite (recoverable from
  the backup, but bad) or race the refresh against the rebuild.
- **Prod uses remote Turso**, so the rewrite is one large transaction over the
  network, and a very large log could be slow / risk an HTTP timeout.

**⇒ Run it during a quiet maintenance window with write activity minimised.** The
safest option is a standalone one-off with the live app scaled down (no refresh,
no sync worker running) — ask if you want that script added; otherwise run the
endpoint during a genuinely quiet window.

## Step-by-step

### A. Land the code
1. Review & merge **#274** → `main`.
2. Review & merge **#275** → `main`.
3. Review & merge **#276** → `main`. (Final deploy includes everything.)

### B. Pre-flight (on prod)
4. Confirm the deploy is live and `app.makespace.org` is healthy.
5. As a super-user, open **`/training-event-log`** — the dry-run page shows how
   many events *would* be created. Sanity-check the number looks right; this also
   confirms the sheet cache is populated and sheets are mapped to equipment.
6. Confirm there are **no existing `TrainingQuizCompleted` events** yet (no
   partial import). If the count on the dry-run page equals the full quiz-row
   count, you're clean.
7. **Take a Turso snapshot/backup** (belt-and-suspenders on top of the automatic
   `*_backup` tables).
8. Pick a **quiet window** — minimal write traffic.

### C. Run it (one call)
9. ```
   curl -X POST https://app.makespace.org/api/training-quiz/backfill-timeline \
        -H "Authorization: Bearer <ADMIN_API_BEARER_TOKEN>"
   ```
   Expect `{"rewrote":true,"inserted":<N>,"totalBefore":<M>,"totalAfter":<M+N>}`.

### D. Verify
10. **Re-run the same call** → expect `{"rewrote":false,"inserted":0}` (idempotent;
    confirms completion).
11. Reload **`/training-event-log`** → should show **0 pending** (all imported).
12. Spot-check health — a member page and a training page load; login works.

### E. Rollback (only if something looks wrong)
13. Restore `events` + `deleted_events` from the `*_backup` tables (or the Turso
    snapshot) and restart the app.

## What this migration does NOT do yet (set expectations)

- **Data capture only.** The equipment / training-status pages still read the
  Google Sheet cache, so nothing user-visible changes. Pointing those reads at
  the new events is the next PR.
- **No going-forward auto-import yet.** New completions won't become events until
  the sync-worker poller is wired to call the append command. Until then you
  *could* re-run `backfill-timeline` to catch up, but the poller is the intended
  design.
- **Sheet rows are not deleted** after import (needs a Google write scope) —
  deferred.

## How this was verified

- Unit tests for the pure ordering/renumber planner and integration tests for the
  executor (middle-insertion, tail renumbering, the `deleted_events` foreign-key
  remap, backups, read-model rebuild, and idempotent no-op).
- End-to-end on a dev store: 422 historical rows woven into 38 real events →
  contiguous `1..460`, zero out-of-chronological-order, member accounts
  preserved, second run a clean no-op.
