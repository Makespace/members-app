// One event, reduced to what the ordering visualisation needs: its position in
// the stored log (event_index order) and the wall-clock time it claims.
export type EventPoint = {
  position: number; // 0-based ordinal in event_index order
  eventIndex: number;
  recordedAtMs: number;
  type: string;
};

// A contiguous run of events with no internal "seam" (see below). Blocks are
// derived purely from the data - they are the maximal runs that are already in
// chronological (recordedAt) order.
export type Block = {
  ordinal: number; // 1-based, in log order
  // Label of the form "<seam-block><letter>", e.g. 1a / 1b / 2 / 3a. The number
  // is the seam-block (split by time seams, 100% confident); the letter is the
  // speculative sub-block within it (omitted when a seam-block has just one).
  label: string;
  startPosition: number; // inclusive, 0-based
  endPosition: number; // inclusive
  startEventIndex: number;
  endEventIndex: number;
  count: number;
  // recordedAt of the first/last event of the run (its span). Because a block is
  // internally in order, first <= last.
  firstRecordedAtMs: number;
  lastRecordedAtMs: number;
  // Every event type present in the block with its count (most frequent first),
  // so the composition can be checked against what each block is believed to be.
  eventTypeCounts: ReadonlyArray<{type: string; count: number}>;
  // How many events in this block are byte-identical (same payload, different
  // event_index/id) to an event elsewhere in the log.
  duplicateCount: number;
  // Per other block, how many of THIS block's events have a byte-identical twin
  // there (most overlap first). e.g. block 2 -> [{label:'3a', count:778}] means
  // all of block 2 is duplicated in 3a. Enables partial-overlap display.
  overlaps: ReadonlyArray<{label: string; count: number}>;
};

// One event in the context window shown around a selected event.
export type NeighbourEvent = {
  eventIndex: number;
  type: string;
  recordedAtMs: number;
  isSelected: boolean;
};

// The detail shown below the block table when an event_index is selected via
// /event-log-order/:index.
export type SelectedEvent = {
  requestedIndex: number;
  // Whether an event with that event_index exists in the log.
  found: boolean;
  // The selected event plus its neighbours, in event_index order.
  window: ReadonlyArray<NeighbourEvent>;
  // Pretty-printed detail of the selected event (all stored fields), if found.
  detailJson: string | null;
  // Which block (label, e.g. "3a") the selected event falls in, if found.
  blockLabel: string | null;
};

// A contiguous run of events that share a structural property - used to detect
// sub-blocks that seams alone miss.
export type Region = {
  startPosition: number;
  endPosition: number;
  startEventIndex: number;
  endEventIndex: number;
  count: number;
  // For a bulk-type run, the single dominant type; for a precision run, ''.
  label: string;
};

export type SignalKind = 'seam' | 'precision' | 'density';

// A block boundary and which independent signals placed it there.
export type DetectedBoundary = {
  eventIndex: number;
  signals: ReadonlyArray<SignalKind>;
  // A seam or precision edge is structural and trusted on its own; a density-only
  // edge can be smeared (e.g. a dump followed by same-day real activity), so it is
  // flagged as low-confidence unless another signal corroborates it.
  corroborated: boolean;
  // For a boundary that includes a density edge: whether the dump was homogeneous
  // (no foreign actor/type folded in) right up to the edge. null when there is no
  // density edge here (a purely seam/precision boundary).
  densityHomogeneous: boolean | null;
};

export type ViewModel = {
  totalEvents: number;
  points: ReadonlyArray<EventPoint>;
  // Blocks derived from the corroborated boundaries (seams + precision edges).
  blocks: ReadonlyArray<Block>;
  // Positions where recordedAt steps backwards relative to the previous event -
  // i.e. the previous event is ahead of it in time.
  seamPositions: ReadonlyArray<number>;
  // Whole-second ("external import") regions - the robust structural signal.
  precisionRuns: ReadonlyArray<Region>;
  // Burst regions - many events packed into a tiny time window (a dump/bulk
  // operation). A block-defining signal (huge density margin over live data).
  densityRuns: ReadonlyArray<Region>;
  // Long single-type runs - informational; these are bulk operations, which
  // occur in live data too, so they are shown but do NOT define blocks.
  bulkTypeRuns: ReadonlyArray<Region>;
  // The boundaries that actually split the blocks, with their evidence.
  boundaries: ReadonlyArray<DetectedBoundary>;
  minRecordedAtMs: number;
  maxRecordedAtMs: number;
  // When true, the density (dump) regions are compressed on the x-axis so the
  // time-spread blocks are easier to read.
  truncate: boolean;
  // Event-type prefix to highlight on the line (?highlight=TroubleTicket),
  // e.g. for visually verifying that a migration wove events in at their
  // correct chronological positions. null = no highlighting.
  highlightPrefix: string | null;
  // Present when the page was reached via /event-log-order/:index.
  selected: SelectedEvent | null;
};
