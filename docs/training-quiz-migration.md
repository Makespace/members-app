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
   command (dedup by row hash), the read-model projection, and the
   `runQuizMigration` append driver. The driver is deliberately **not** exposed
   over HTTP: appending a historical row claims its hash with `recordedAt` = now,
   which would permanently prevent #276 from weaving that row in at its
   historical time. It is reserved for the going-forward sync-worker poller
   (which only ever sees fresh rows, where append-at-tail is correct).
3. **#276** – the **one-time historical catch-up**: weaves cached quiz rows into
   the log at the point in time they actually happened, renumbering `event_index`
   so replay order stays chronological. Exposed as
   `POST /api/training-quiz/backfill-timeline` — the **only** quiz-import
   endpoint.

> Only **#276** rewrites history, and only once. Going forward, completions are
> appended normally (they are always newer than the tail), so the timeline
> surgery never runs again.

## Before you run it — read this

The backfill **rewrites the whole `events` table in one atomic, drift-guarded
batch**: it reads the log, plans the new order, then executes a single batch
that re-inserts every event (every column, payloads verbatim) in chronological
order with fresh `event_index` values, re-pointing the `deleted_events` foreign
key — then rebuilds the read model. The batch's first statement is a **drift
guard**: if any event was appended or any deletion recorded between the read and
the batch executing, the guard fails and the whole batch rolls back with nothing
changed. A concurrent write can never be silently dropped — the worst case is a
clean "aborted, re-run" error.

There is **no in-database backup**: the whole rewrite is a single atomic
transaction (nothing is dropped unless it all commits), so a `*_backup` table
written in that same transaction would protect nothing the transaction's own
rollback doesn't already cover. For a committed-but-wrong run the recovery path
is **Turso's point-in-time restore** (see step 13). Because there's no backup
guard to clear, the backfill can be **re-run freely** — including one piece of
equipment at a time via `?equipmentId=` (see step 9).

It is idempotent (nothing new to insert ⇒ it does not touch the log) and
**refuses to run** if:

- any existing event has an unparseable `recordedAt`;
- the existing log is not already in chronological (`recordedAt`) order —
  renumbering must never reorder existing events.

Care is still warranted:

- **Quiet window recommended.** Correctness no longer depends on it, but a
  write landing mid-run makes the rewrite abort (harmlessly — just re-run), a
  write landing just after it gets a transient "resource has changed" error,
  and the app's 10s read-model refresh is only reconciled once the post-rewrite
  `reset()` lands.
- **Prod uses remote Turso**, so a very large log makes the rewrite slow — see
  the timeout note in step 9.

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
   The backfill enforces these same preconditions itself (parseable `recordedAt`,
   chronological order) and **refuses to run, changing nothing**, if either is
   violated — so there's no separate pre-check to run.
7. **Take a Turso snapshot/backup** — this is the recovery path if a run commits
   something wrong (there is no in-database `*_backup`; see step 13).
8. Pick a **quiet window** — minimal write traffic.

### C. Run it (one call)
9. ```
    curl -X POST https://app.makespace.org/api/training-quiz/backfill-timeline \
         -H "Authorization: Bearer <ADMIN_API_BEARER_TOKEN>"
    ```
    Expect `{"rewrote":true,"inserted":<N>,"totalBefore":<M>,"totalAfter":<M+N>}`.

    **Optional — canary one machine first.** Append `?equipmentId=<uuid>` to
    weave in just that equipment's sheet rows:
    ```
    curl -X POST "https://app.makespace.org/api/training-quiz/backfill-timeline?equipmentId=<uuid>" \
         -H "Authorization: Bearer <ADMIN_API_BEARER_TOKEN>"
    ```
    The rewrite still renumbers the whole log (renumbering is cheap), but only
    that machine's rows are inserted — so you can verify one piece of equipment
    on prod before running the rest. Each run is independently idempotent and
    there is no backup guard to clear between runs, so you can chain scoped runs
    or finish with the unscoped call above to sweep up everything else.

    **Expect this to take roughly 40–60 minutes** (based on the row volume seen
    in #274; prod uses remote Turso and the rewrite re-inserts every event). So
    **the curl will almost certainly time out** long before it finishes — that's
    Fly's proxy giving up, not the rewrite failing. Don't panic and don't re-run:
    it's still completing server-side, and the summary is written to the app logs
    regardless of whether the HTTP response made it out. Wait for it to finish
    (watch the logs), then verify as below — the idempotent re-run doubles as the
    completion check.

### D. Verify
10. **Re-run the same call** → expect `{"rewrote":false,"inserted":0}` (idempotent;
    confirms completion).
11. Reload **`/training-event-log`** → should show **0 pending** (all imported).
12. Spot-check health — a member page and a training page load; login works.

### E. Rollback (only if something looks wrong)
13. **Restore from the Turso snapshot** (point-in-time restore to just before the
    run — step 7) and restart the app. There is no in-database backup to restore
    from; the rewrite is atomic, so a run that *aborts* changes nothing and needs
    no rollback — this is only for a run that committed something wrong.

## What this migration does NOT do yet (set expectations)

- **Data capture only.** The equipment / training-status pages still read the
  Google Sheet cache, so nothing user-visible changes. Pointing those reads at
  the new events is the next PR.
- **No going-forward auto-import yet.** New completions won't become events until
  the sync-worker poller is wired to call the append command. Until then you
  *could* re-run `backfill-timeline` to catch up (it's freely re-runnable — no
  backup guard to clear), but the poller is the intended design.
- **Sheet rows are not deleted** after import (needs a Google write scope) —
  deferred.

## Next steps: consume the events instead of the Google Sheets cache

Once the migration has run, the historical quiz data lives in the event log — but
the equipment/member pages and owner emails still read the **Google Sheets
cache**, so this data isn't actually used yet. This section specs the follow-on
work to switch those reads over. It's the natural continuation of the stack, to
pick up after #274–#276 merge.

### The current picture (a single chokepoint)

Almost all quiz-data consumption funnels through one module:
**`src/read-models/external-state/equipment-quiz.ts`**. It reads the sheet cache
(`getSheetData` / `getSheetDataByMemberNumber`), resolves each row to a piece of
equipment (`equipment.getTrainingSheetIdMapping()`) and to a member
(`members.getByMemberNumber` / `getByEmail`), decides **pass = full marks**
(`row.percentage >= 100`), and feeds exactly three consumers:

| Consumer | What it shows |
| --- | --- |
| Equipment page (`queries/equipment`) | "Members awaiting training" (passed quiz, not yet marked trained) + failed quizzes |
| Member page → training matrix | Per-equipment ✅ passed / 〰️ attempted |
| Owner summary emails (`sync-worker/training-summary`) | Count of members awaiting training per equipment |

Two things to keep in mind:

- **"Passed the quiz" is not "trained on equipment".** Trained status comes from
  `MemberTrainedOnEquipment(By)` events → `trainedMemberstable` and is *already*
  event-sourced. This work only touches the **quiz** side.
- `training-status.csv` already reads the read model, not the cache — unaffected.

### ⚠️ Ordering dependency — read this first

You **cannot repoint the reads to events until the events are kept current.**
Today new completions only enter the log via the append command, and nothing
calls it automatically yet; the sheet cache, by contrast, refreshes every ~60s.
Switch the reads over too early and the pages would show the historical backfill
but **miss every new completion** until someone manually re-runs the import. So
the going-forward poller must land **before** (or with) the repoint.

### Phased plan

**PR A — going-forward poller (keeps events fresh).** Wire the sync worker to call
the `RecordTrainingQuizCompletion` append command for new sheet rows on its
existing poll cycle (dedup by `rowHash` already makes this safe and idempotent).
After this, the event log stays current without manual runs.

**PR B — event-sourced quiz views + repoint (the core, ~80%).** Add read-model
getters that answer the same questions `equipment-quiz.ts` answers today, but
query `trainingQuizCompletionsTable` (populated by `TrainingQuizCompleted`
events) instead of the sheet cache — same equipment/member resolution, pass logic
now `score >= maxScore`. Live in the existing
`read-models/shared-state/training-quiz/` module and unit-testable purely from
events. Then repoint the three consumers, keeping the view-model shapes identical
so the `render.ts` files barely change.

**PR C — retire the cache path.** Remove `equipment-quiz.ts` and the quiz uses of
`getSheetData` (keep `getSheetData` only if the admin `log-google` dump still
wants the raw cache).

### Decisions to confirm with Paul

- **Pass semantics:** keep "full marks" (`score >= maxScore`, i.e. today's
  `percentage >= 100`)? Some quizzes may intend a lower pass mark.
- **Display window:** keep the equipment page's "last 12 months" filter?
- **Index:** add an index on
  `trainingQuizCompletionsTable(trainingSheetId, memberNumberProvided)` for the
  per-equipment / per-member queries (currently only the `rowHash` primary key).

## How this was verified

- Unit tests for the pure ordering/renumber planner and integration tests for the
  executor (middle-insertion, tail renumbering, the `deleted_events` foreign-key
  remap, read-model rebuild, idempotent no-op, and repeated/scoped re-runs).
- End-to-end on a dev store: 422 historical rows woven into 38 real events →
  contiguous `1..460`, zero out-of-chronological-order, member accounts
  preserved, second run a clean no-op.
