// Pure planning for the one-time historical catch-up.
//
// Given the events already in the log (each with the millisecond timestamp it
// should be ordered by - `recordedAt`) plus the historical quiz events we want
// to weave in, produce the full new ordering of the log with fresh, contiguous
// event_index values, and a map from each existing event's old index to its new
// one so callers can re-point anything that references an index (e.g. the
// deleted_events foreign key).
//
// This is deliberately pure and DB-free: it is the part most worth testing in
// isolation before we let anything rewrite the source-of-truth event store.

// A row as it will be (re-)written into the events table. `payload` is kept
// verbatim so existing events are byte-for-byte unchanged apart from their index.
export type TimelineRow = {
  id: string;
  eventType: string;
  payload: string;
  recordedAtMs: number;
};

export type ExistingRow = TimelineRow & {oldIndex: number};

type RebuildPlan = {
  // The complete events table in its new order, indexed 1..M.
  rows: ReadonlyArray<TimelineRow & {newIndex: number}>;
  // Old -> new index for existing events only (new events had no prior index).
  remap: ReadonlyArray<{oldIndex: number; newIndex: number}>;
};

type Tagged = {
  row: TimelineRow;
  oldIndex: number | null; // null => a newly inserted event
  seq: number; // original position within its own source, for stable ties
};

// Order by timestamp; on a tie keep existing events before newly inserted ones,
// and otherwise preserve each source's original order. This keeps the log's
// existing invariant (index order == recordedAt order) intact and deterministic.
const byTimeline = (a: Tagged, b: Tagged): number =>
  a.row.recordedAtMs - b.row.recordedAtMs ||
  (a.oldIndex === null ? 1 : 0) - (b.oldIndex === null ? 1 : 0) ||
  a.seq - b.seq;

export const planTimelineRebuild = (
  existing: ReadonlyArray<ExistingRow>,
  inserts: ReadonlyArray<TimelineRow>
): RebuildPlan => {
  const tagged: ReadonlyArray<Tagged> = [
    ...existing.map((row, seq) => ({row, oldIndex: row.oldIndex, seq})),
    ...inserts.map((row, seq) => ({row, oldIndex: null, seq})),
  ];

  const sorted = [...tagged].sort(byTimeline);

  const rows = sorted.map((t, i) => ({
    id: t.row.id,
    eventType: t.row.eventType,
    payload: t.row.payload,
    recordedAtMs: t.row.recordedAtMs,
    newIndex: i + 1,
  }));

  const remap = sorted
    .map((t, i) => ({oldIndex: t.oldIndex, newIndex: i + 1}))
    .filter(
      (r): r is {oldIndex: number; newIndex: number} => r.oldIndex !== null
    );

  return {rows, remap};
};
