# Event-log ordering investigation

Reference notes on the structure and (mis)ordering of the Makespace event log, and
what can and can't be done to reorder it. Written up from an investigation run
against a **local copy of the production event store** (`makespace-member-app.db`,
12,699 events) loaded into the dev Docker containers. Every figure below was
measured by replaying events through the real read-model code
(`src/read-models/shared-state`), not estimated.

> **One-line takeaway.** The log is *not* in `recordedAt` (chronological) order and
> cannot be naively sorted into it — a straight sort silently destroys ~65% of the
> training history. It *can* be reordered losslessly, but only by treating events by
> **type/role** (setup vs. training vs. operational), not by moving whole blocks.

## Why this came up

The training-quiz migration originally wanted to weave historical quiz completions
into the log *at their historical position* and renumber `event_index` to keep replay
chronological (`rebuildEventTimeline`). Running the backfill on prod immediately hit
the executor's **order guard**:

```
Refusing to rebuild timeline: 2 event(s) have a recordedAt earlier than the event
before them ... The log must be in chronological order before it can be renumbered.
```

That guard was correct to fire, and investigating *why* uncovered everything below.

## Key architectural fact: append order IS causal order

The event store is a single serializing writer; `event_index` is a monotonic counter
assigned at commit time. That sequence is therefore a valid causal (topological)
ordering **by construction** — every prerequisite was already committed before the
event that depends on it. There is no separate "causal timestamp" to recover:
`recordedAt` is a *payload fact* (a wall-clock annotation), not a causal position, and
for this log the two diverge badly.

The read model relies on this. Projections in `update-state.ts` enforce preconditions
and throw `InconsistentEventError` when they aren't met — e.g. `MemberTrainedOnEquipment`
requires the member to be linked *and* the equipment to exist (`update-state.ts:263`).
A thrown event is **caught, logged to `failedEventsTable`, and skipped** — replay
continues (`update-state.ts:588`). So a bad ordering does **not** crash the app; it
**silently drops** events and quietly diverges the read model. That's the real danger.

## Structure of the log

Two adjacent-inversion "seams" split the stored log into three internally-sorted runs.
A useful signal for distinguishing app-generated events from external imports is
timestamp precision: **whole-second (`.000`) timestamps ⇒ external import**;
millisecond precision ⇒ app-generated.

| Block | event_index | rows | recordedAt span | precision | what it is |
|---|---|---|---|---|---|
| **1a genesis dump** | 1–3859 | 3,859 | 2024-07-03 (single 18-min window) | ms → app | 1st setup import: member registry (2,361 `MemberDetailsUpdated` + 1,469 `MemberNumberLinkedToEmail`) |
| **1b sparse live** | 3860–4198 | 16 | 2024-07-04 → 07-22 | ms → app | real activity (2 areas, equipment, owners, a trainer, detail updates) |
| **1c 2024-08-01 batch** | 4199–5101 | 903 | 2024-08-01 (single 71-min window) | ms → app | 2nd setup import: registry + equipment/area setup |
| **1d sparse live** | 5102–5194 | 93 | 2024-08-03 → 10-12 | ms → app | real activity (41 owners, 10 equipment, 18 sheets, 6 trainers, details) |
| **2 training import #1** | 5195–5972 | 778 | 2020-10 → 2022-11 | 100% whole-sec → external | historical training, all `MemberTrainedOnEquipment` |
| **3a training import #2** | 5973–7299 | 1,327 | 2020-10 → 2023-12 | 100% whole-sec → external | historical training, all `MemberTrainedOnEquipment` |
| **3b live stream** | 7300–13022 | 5,723 | 2024-01 → 2026-08 | mostly ms | genuine ongoing operation |

The two seams (both "jump back to 2020"):
- `@5195`: end of the 2024 setup (1a–1d) → start of training import #1.
- `@5973`: end of training import #1 → start of training import #2.

## The core problem: collapsed creation dates

The genesis import (1a) and the 2024-08-01 batch (1c) **collapsed every member /
equipment / area creation date to the import run's clock** (2024-07-03 / 2024-08-01),
throwing the true historical dates away. The training imports (blocks 2 / 3a) kept
their **real 2020–2023 dates**. So the log literally asserts impossible things like:

> Member #131 was *trained* on the Ultimakers in **2020-10-01**, but *registered* in
> **2024-07-03**.

Concretely (real events, verifiable by id):

```
REGISTRATION  event_index  993   MemberNumberLinkedToEmail   recordedAt 2024-07-03  (member #131)
EARLIEST TRAIN event_index 5195   MemberTrainedOnEquipment    recordedAt 2020-10-01  (Ultimakers)
```

Append order hides this (993 registers before 5195 trains → fine). Sorting by
`recordedAt` exposes it: the training replays ~3.8 years before the member exists.

### Measured effect of a naïve `recordedAt` sort

Replaying the whole log sorted by `recordedAt`:

| read-model table | current (append) | recordedAt-sorted | Δ |
|---|---|---|---|
| `trainedMembers` | 2,553 | **906** | **−1,647 (~65%)** |
| `failedEventsTable` | 201 | **2,684** | **+2,483** |

Failures are overwhelmingly `MemberTrainedOnEquipment` (2,585), split between
"unknown member" and "unknown equipment" — because both members *and* equipment carry
collapsed 2024 dates while the training carries real 2020 dates. **No error surfaces;
the training history just silently disappears.**

## Duplicate finding: Block 2 is redundant

Independent of ordering: **777 training facts are stored twice** — byte-identical
`payload`, different UUIDs, different `event_index`. Block 3a is a later, fuller
re-import that contains **all** of Block 2's records (plus ~13 more months, to
2023-12) and even fixed one internal double-entry Block 2 had (member #131 /
Ultimakers appears at 5195, 5196 *and* 5973 — tripled).

- **Block 2 (778 rows) can be dropped with zero information loss.**
- Verify: `SELECT payload, count(*) FROM events GROUP BY payload HAVING count(*) > 1;`
  (778 redundant rows, 100% `MemberTrainedOnEquipment`.)

## Reordering schemes evaluated

Everything below was replayed and diffed against the baseline read model.

| Scheme | `trainedMembers` | equipment failures | verdict |
|---|---|---|---|
| Naïve `recordedAt` sort | 906 (−1,647) | 2,585 | destroys data |
| Date-move genesis→2013, imports→2015/16 (by block) | 1,944 (−609) | 882 | equipment wall |
| Index-move 1b/1d after training (whole blocks) | 2,052 (−501) | 773 | better, still cascades |
| **Type-aware: setup before / operational after** | **2,553 (0)** | **0** | **lossless** |

### Why whole-block moves fail

Blocks 1b and 1d **mix prerequisites with operations**. Moving a whole block after
the training strands its prerequisites. Example (measured): 1b's `AreaCreated`
"3D Printers" (`#3860`) is a transitive prerequisite for **663 training records** —
it's the area for the Bambu X1 (1b) *and* the Ultimakers / Markforged / Form 3 added
in 1c. Move 1b wholesale and that area is gone when the 2020–2023 training replays →
the equipment fails to create → 423 downstream training failures cascade. Trainers
add a second chain: a `TrainerAdded` requires the member to be an `OwnerAdded` first.

### The rule that works: split by type, not by block

Only blocks 1b and 1d need splitting; the rest move wholesale. The causal chains are
`link → details/owner → trainer` and `area → equipment → sheet → training`. So:

- **Keep before the training** (leave in place): every *creation/setup* event —
  `MemberNumberLinkedToEmail`, `AreaCreated`, `EquipmentAdded`,
  `EquipmentTrainingSheetRegistered`, `TrainerAdded`, `OwnerAdded`.
- **Move after the training**: only genuinely *operational* events —
  `MemberDetailsUpdated`, `OwnerAgreementSigned`.

In practice this relocates only **~17 events** out of 1b+1d's 109; the rest never move.

**Result: read model BYTE-IDENTICAL across all 12 tables** (members, trained,
owners, trainers, emails, areas, equipment, failed-events, … all unchanged). This is
the strongest possible success metric — the reorder provably changes *nothing* the
read model computes. It's lossless because it preserves relative order within each
event stream, and every projection is either set-membership (order-independent once
prerequisites exist) or last-write-wins (relative order preserved).

## Causal order vs. chronological order

The type-aware reorder is **causally correct but not chronological**: the setup
prerequisites we "keep before" still carry their 2024 dates while sitting ahead of the
2020 training (92 such events). To make it *also* chronological you must additionally
**date-move the setup imports to pre-2020** (the same treatment already applied to
1a→2013, 1c→2014 — they're the same class of collapsed-date import).

Unified model (no per-block special-casing):

```
SETUP       links, areas, equipment, sheets, trainers, owner-adds
            → date-move to pre-2020, positioned before the training
TRAINING    blocks 2 + 3a
            → keep real 2020–2023 dates (drop block 2 as duplicate)
OPERATIONS  detail updates, agreement-signings, genuine 2024 activity
            → keep 2024 dates, positioned after the training
LIVE        block 3b → unchanged
```

### Measured outcome of the unified scheme

- **Chronological order:** seams drop from 4 → **2**. The 92 setup culprits are gone.
  The 2 residual seams are (i) the Block 2/3a duplicate overlap (→ drop Block 2) and
  (ii) a cosmetic tail seam (the moved 2024 ops sit just before 3b's 2024-01 start;
  interleaving them into 3b by date clears it).
- **Read-model diff — only date columns change**, exactly the ones intended:

  | table | changed columns |
  |---|---|
  | `members` | `joined`, `superUserSince` |
  | `owners` | `ownershipRecordedAt` |
  | `trainers` | `since` |
  | `memberEmails` | `addedAt`, `verifiedAt` |
  | `failedEventsTable` | `payload` (only because `recordedAt` is embedded in the JSON) |
  | everything else (`trainedMembers`, `equipment`, `areas`, `memberNumbers`, …) | **identical** |

  Crucially `trainedMembers` is **fully identical** (training dates never move), and all
  identity/membership/relationship data is unchanged. Only the placeholder creation
  dates shift.

### The honest tradeoff

Date-moving the setup **changes user-visible "member since / owner since" dates** from
`2024-07-03` to ~2013. Neither value is the *true* date — the real ones were destroyed
by the genesis import. So it's a choice between two placeholders: today's 2024
(misleading: implies everyone joined on one day in 2024) vs. 2013 (misleading: implies
everyone joined at Makespace's founding). Fine for internal ordering; a conscious call
for displayed dates — 2024 may be the *less* wrong lie.

## Recommendations

1. **For the quiz migration itself: append at the tail.** Carry the quiz's real date
   as a payload fact (`completedAt`) — which is what the read model reads anyway
   (`update-state.ts:548`). No weaving, no renumbering. The log was never chronological
   and the read model doesn't key on event position, so append-at-tail is both safe and
   visually identical. This is the recommended path and needs none of the reordering
   below.
2. **A lossless chronological reorder of the historical log is feasible** but only
   type-aware, and only worth it for a tidier log for future reasoning/export — it
   changes nothing user-visible except intended date fields. If done, it must use the
   careful `deleted_events` FK remap that `rebuildEventTimeline` already implements; a
   bare `UPDATE` on `event_index` is unsafe (unique-collision mid-update + dangling FK).
3. **Drop Block 2** (redundant duplicate) as an easy, independent cleanup.

## How to reproduce / verify

- **Duplicates:** `SELECT payload, count(*) FROM events GROUP BY payload HAVING count(*)>1;`
  (run against the *event store*, not the read model — the `/db` page queries the read
  model, which has no `events` table).
- **Ordering / replay experiments:** load the event store, replay via
  `initSharedReadModel(...).updateState` in the order under test, then compare the
  read-model tables (accessible via `rm._underlyingReadModelDb`) against a baseline
  built in append order. The failure detail lives in `failedEventsTable`.
- **Data used:** local copy of the prod event store in the dev Docker container
  (`members-app-sync_worker-1:/db/makespace-member-app.db`). Verified pristine (stable
  content digest, still in append order, zero injected events) — the analyses never
  wrote to the `events` table. (Note: two stale `events_backup` / `deleted_events_backup`
  tables from an old integration-test run exist in that local DB and are unrelated junk;
  safe to drop.)
