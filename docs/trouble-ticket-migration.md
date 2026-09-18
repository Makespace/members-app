# Trouble tickets → event timeline migration

Moves historical trouble tickets out of the Google Sheets cache and into the
append-only event log, so Makespace keeps a complete, portable record of every
ticket ever raised — and so tickets can grow app-native workflow (status
changes, assignment, notifications) in later PRs. This doc is the concrete
runbook for landing the code and running the one-time migration on prod. It
follows the training-quiz migration (`docs/training-quiz-migration.md`)
step-for-step; differences are called out.

## What ships (stacked PRs — merge bottom-up)

1. **#296** – the `TroubleTicketCreated` event, the `record` command (dedup by
   row hash), the read-model projection, and the `runTroubleTicketIngest`
   append driver. The driver is deliberately **not** wired to the sync worker
   and **not** exposed over HTTP: appending a historical row claims its hash
   with `recordedAt` = now, which would permanently prevent this PR from
   weaving that row in at its historical time.
2. **This PR** – the **one-time historical catch-up**: weaves cached
   trouble-ticket rows into the log at the point in time they were actually
   submitted, renumbering `event_index` so replay order stays chronological.
   Exposed as `POST /api/trouble-tickets/backfill-timeline` — the **only**
   ticket-import endpoint. Supports `?dryRun=true` (report, write nothing) —
   this replaces the quiz migration's dry-run page; ticket volume is small
   enough that a JSON summary with a sample is sufficient.
3. **Next** – the going-forward sync-worker poller + repointing the
   `/trouble-tickets` page at the read model. **Do not merge the poller until
   the backfill has run and been verified on prod** (see the ordering trap
   above).

> Only this PR rewrites history, and only once. Going forward, tickets are
> appended normally (they are always newer than the tail), so the timeline
> surgery never runs again.

## Before you run it — read this

The backfill **rewrites the whole `events` table in one atomic, drift-guarded
batch** using the same executor the quiz migration used
(`src/training-quiz/rebuild-event-timeline.ts`): it reads the log, plans the
new order, then executes a single batch that re-inserts every event (every
column, payloads verbatim) in chronological order with fresh `event_index`
values, re-pointing the `deleted_events` foreign key — then rebuilds the read
model. The batch's first statement is a **drift guard**: if any event was
appended or any deletion recorded between the read and the batch executing,
the guard fails and the whole batch rolls back with nothing changed.

There is **no in-database backup**: the rewrite is a single atomic transaction,
so the recovery path for a committed-but-wrong run is **Turso's point-in-time
restore** (step 12). Because there's no backup guard to clear, the backfill can
be **re-run freely** — including a canary scoped by date via `?before=`.

It is idempotent (nothing new to insert ⇒ it does not touch the log) and
**refuses to run** if any existing event has an unparseable `recordedAt`, or
the existing log is not already in chronological order.

Care is still warranted:

- **Quiet window recommended.** A write landing mid-run makes the rewrite abort
  (harmlessly — just re-run); a write landing just after gets a transient
  "resource has changed" error.
- **Prod uses remote Turso**, and the rewrite re-inserts **every** event — the
  log now includes the migrated quiz history, so expect a similar duration to
  the quiz run (~40–60 minutes) even though far fewer rows are being inserted.

## Step-by-step

### A. Land the code
1. Review & merge **#296** → `main`.
2. Review & merge **this PR** → `main`. (Deploys to Fly automatically.)

### B. Pre-flight (on prod)
3. Confirm the deploy is live and `app.makespace.org` is healthy.
4. Dry-run the import:
   ```
   curl -X POST "https://app.makespace.org/api/trouble-tickets/backfill-timeline?dryRun=true" \
        -H "Authorization: Bearer <ADMIN_API_BEARER_TOKEN>"
   ```
   Expect `{"totalCandidates":<N>,"wouldInsert":<N>,"alreadyImported":0,"sample":[...]}`.
   Sanity-check the count against the sheet's row count and eyeball the sample.
5. Confirm there are **no existing `TroubleTicketCreated` events** yet:
   `wouldInsert` equal to `totalCandidates` (and `alreadyImported: 0`) means
   you're clean.
6. **Take a Turso snapshot/backup** — the recovery path if a run commits
   something wrong.
7. Pick a **quiet window** — minimal write traffic.

### C. Run it (one call)
8. ```
   curl -X POST https://app.makespace.org/api/trouble-tickets/backfill-timeline \
        -H "Authorization: Bearer <ADMIN_API_BEARER_TOKEN>"
   ```
   Expect `{"rewrote":true,"inserted":<N>,"totalBefore":<M>,"totalAfter":<M+N>}`.

   **Optional — canary the oldest year first.** Append `?before=<ISO date>` to
   weave in only submissions strictly before that date:
   ```
   curl -X POST "https://app.makespace.org/api/trouble-tickets/backfill-timeline?before=2022-01-01" \
        -H "Authorization: Bearer <ADMIN_API_BEARER_TOKEN>"
   ```
   The rewrite still renumbers the whole log either way; each run is
   independently idempotent, so chain scoped runs or finish with the unscoped
   call to sweep up everything else.

   **Expect the curl to time out** — that's Fly's proxy giving up, not the
   rewrite failing. Don't panic and don't re-run: it's still completing
   server-side, and the summary is written to the app logs regardless. Wait for
   it to finish (watch the logs), then verify as below — the idempotent re-run
   doubles as the completion check.

### D. Verify
9. **Re-run the same call** → expect `{"rewrote":false,"inserted":0}`.
10. Re-run the dry-run call → expect `"wouldInsert":0`.
11. Spot-check health — `/trouble-tickets` (still cache-backed until the next
    PR), a member page, and login all work; `/event-log-order` (super-user)
    shows no out-of-order events.

### E. Rollback (only if something looks wrong)
12. **Restore from the Turso snapshot** (point-in-time restore to just before
    the run — step 6) and restart the app. A run that *aborts* changes nothing
    and needs no rollback — this is only for a run that committed something
    wrong.

## What this migration does NOT do yet (set expectations)

- **Data capture only.** `/trouble-tickets` still reads the Google Sheet cache,
  so nothing user-visible changes. Repointing it is the next PR.
- **No going-forward auto-import yet.** New tickets won't become events until
  the sync-worker poller is wired up (next PR — and only after this backfill
  has been verified on prod). Until then the backfill is freely re-runnable to
  catch up.
- **No status workflow yet.** Every migrated ticket is `Todo`; assignment,
  resolution, the board and emails are later PRs in the stack.

## How this was verified

- The generic planner/executor already carries the quiz migration's test suite
  (middle-insertion, tail renumbering, `deleted_events` remap, drift refusal,
  idempotent no-op).
- New tests cover the ticket-specific builder: weaving a 2021 ticket ahead of
  newer events with `recordedAt` = submission time, in-batch dedup of
  byte-identical rows, `?before=` canary scoping, dry-run planning without
  writes, and idempotent re-runs.
