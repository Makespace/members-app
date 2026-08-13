import {User, StoredDomainEvent} from '../../types';
import {Dependencies} from '../../dependencies';
import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {FailureWithStatus} from '../../types/failure-with-status';
import {
  Block,
  DetectedBoundary,
  EventPoint,
  Region,
  SelectedEvent,
  SignalKind,
  ViewModel,
} from './view-model';
import {mustBeSuperuser} from '../util';

// How many events either side of the selected one to show as context.
const WINDOW = 8;

// Minimum length for a homogeneous run to count as a structural region. Set well
// above any incidental short run so naturally-varying live data never qualifies.
const PRECISION_MIN_RUN = 100; // consecutive whole-second events (import tell)
const BULK_TYPE_MIN_RUN = 200; // consecutive same-type events (a bulk operation)
const DENSITY_MIN_RUN = 200; // events packed into DENSITY_MAX_SPAN_MS => a dump
const DENSITY_MAX_SPAN_MS = 24 * 60 * 60 * 1000; // 1 day
// Boundaries from different signals within this many positions are treated as
// the same transition (e.g. a seam and a precision edge that coincide). Kept
// small so genuinely distinct nearby boundaries - like a narrow 16-event block -
// are not swallowed.
const MERGE_TOLERANCE = 5;
// Events either side of a density edge examined for fold-in (foreign actor/type).
const HOMOGENEITY_WINDOW = 30;

// Fields that differ between two byte-identical events (per-row storage and
// deletion columns) - excluded so the remaining payload forms the identity key.
const DUPLICATE_EXCLUDED_FIELDS = new Set([
  'event_index',
  'event_id',
  'deletedAt',
  'deleteReason',
  'markDeletedByMemberNumber',
]);

// Canonical key of an event's payload (sorted keys, storage/deletion fields
// removed). Two events with the same key are byte-identical facts.
const duplicateKey = (event: StoredDomainEvent): string => {
  const record = event as unknown as Record<string, unknown>;
  const canonical: Record<string, unknown> = {};
  for (const key of Object.keys(record).sort()) {
    if (!DUPLICATE_EXCLUDED_FIELDS.has(key)) {
      canonical[key] = record[key];
    }
  }
  return JSON.stringify(canonical);
};

// O(n) duplicate detection: hash-group events by their canonical key, then map
// each group's positions to blocks. Returns, per block, how many of its events
// are duplicated and how those duplicates break down across the other blocks
// (distinct source events per partner block - so a partial overlap shows too).
const computeDuplicates = (
  ordered: ReadonlyArray<StoredDomainEvent>,
  blocks: ReadonlyArray<Block>
): {
  duplicateCount: number[];
  overlaps: Array<Array<{label: string; count: number}>>;
} => {
  const n = ordered.length;
  const blockOfPosition = new Int32Array(n);
  blocks.forEach((block, blockIndex) => {
    for (let p = block.startPosition; p <= block.endPosition; p++) {
      blockOfPosition[p] = blockIndex;
    }
  });

  const keyToPositions = new Map<string, number[]>();
  for (let p = 0; p < n; p++) {
    const key = duplicateKey(ordered[p]);
    const bucket = keyToPositions.get(key);
    if (bucket) bucket.push(p);
    else keyToPositions.set(key, [p]);
  }

  const duplicateCount = new Array<number>(blocks.length).fill(0);
  // overlapCounts[bi] maps another block bj -> how many distinct events of bi
  // have at least one twin in bj.
  const overlapCounts = blocks.map(() => new Map<number, number>());
  for (const positions of keyToPositions.values()) {
    if (positions.length < 2) continue;
    for (const p of positions) {
      const bi = blockOfPosition[p];
      duplicateCount[bi]++;
      const targetBlocks = new Set<number>();
      for (const q of positions) {
        if (q === p) continue;
        const bj = blockOfPosition[q];
        if (bj !== bi) targetBlocks.add(bj);
      }
      for (const bj of targetBlocks) {
        overlapCounts[bi].set(bj, (overlapCounts[bi].get(bj) ?? 0) + 1);
      }
    }
  }

  const overlaps = blocks.map((_, bi) =>
    [...overlapCounts[bi].entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([bj, count]) => ({label: blocks[bj].label, count}))
  );

  return {duplicateCount, overlaps};
};

// Maximal runs where `classOf` returns the same non-null label for at least
// minRun consecutive events. This detects homogeneous regions (imports, bulk
// operations) without a fragile threshold on a continuous variable, and - unlike
// a composition-change detector - it never fires on naturally-varying live data.
const homogeneousRuns = (
  n: number,
  classOf: (position: number) => string | null,
  minRun: number
): Array<{start: number; end: number; label: string}> => {
  const runs: Array<{start: number; end: number; label: string}> = [];
  let start = 0;
  while (start < n) {
    const label = classOf(start);
    if (label === null) {
      start++;
      continue;
    }
    let end = start;
    while (end + 1 < n && classOf(end + 1) === label) {
      end++;
    }
    if (end - start + 1 >= minRun) {
      runs.push({start, end, label});
    }
    start = end + 1;
  }
  return runs;
};

// Burst regions: stretches where >= minRun consecutive events are packed into
// <= maxSpanMs of recordedAt (a dump / bulk operation). The `span >= 0` guard
// excludes windows that straddle a seam (recordedAt jumps backward there, which
// would make the span negative and spuriously "dense").
const burstRuns = (
  recordedAtMs: ReadonlyArray<number>,
  minRun: number,
  maxSpanMs: number
): Array<{start: number; end: number; label: string}> => {
  const n = recordedAtMs.length;
  const dense = new Array<boolean>(n).fill(false);
  for (let i = 0; i + minRun - 1 < n; i++) {
    const span = recordedAtMs[i + minRun - 1] - recordedAtMs[i];
    if (span >= 0 && span <= maxSpanMs) {
      for (let j = i; j < i + minRun; j++) dense[j] = true;
    }
  }
  const runs: Array<{start: number; end: number; label: string}> = [];
  let start = -1;
  for (let i = 0; i < n; i++) {
    if (dense[i] && start === -1) start = i;
    if (!dense[i] && start !== -1) {
      runs.push({start, end: i - 1, label: ''});
      start = -1;
    }
  }
  if (start !== -1) runs.push({start, end: n - 1, label: ''});
  return runs;
};

// Every event type in a slice of events with its count, most frequent first.
const eventTypeCounts = (
  types: ReadonlyArray<string>
): ReadonlyArray<{type: string; count: number}> => {
  const counts = new Map<string, number>();
  for (const type of types) {
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([type, count]) => ({type, count}))
    .sort((a, b) => b.count - a.count);
};

// Split the log into blocks at the given boundary start-positions (each is the
// first event of a new block). Entirely data-driven: the boundaries come from
// the detection signals, nothing is hard-coded.
const detectBlocks = (
  points: ReadonlyArray<EventPoint>,
  types: ReadonlyArray<string>,
  boundaryStarts: ReadonlyArray<number>,
  seamPositions: ReadonlyArray<number>
): ReadonlyArray<Block> => {
  if (points.length === 0) {
    return [];
  }
  const boundaries = [0, ...boundaryStarts, points.length];
  const spans: Array<{start: number; end: number}> = [];
  for (let b = 0; b < boundaries.length - 1; b++) {
    spans.push({start: boundaries[b], end: boundaries[b + 1] - 1});
  }

  // The seam-block number is how many seams start at or before this block (each
  // seam begins a new seam-block). Within a seam-block, sub-blocks get letters
  // a, b, c...; a seam-block with a single block keeps just the number.
  const seamBlockOf = (startPosition: number) =>
    1 + seamPositions.filter(position => position <= startPosition).length;
  const perSeamBlock = new Map<number, number>();
  for (const span of spans) {
    const sb = seamBlockOf(span.start);
    perSeamBlock.set(sb, (perSeamBlock.get(sb) ?? 0) + 1);
  }
  const letterCursor = new Map<number, number>();

  return spans.map((span, i) => {
    const {start, end} = span;
    const sb = seamBlockOf(start);
    const cursor = letterCursor.get(sb) ?? 0;
    letterCursor.set(sb, cursor + 1);
    const hasLetters = (perSeamBlock.get(sb) ?? 1) > 1;
    const label = `${sb}${hasLetters ? String.fromCharCode(97 + cursor) : ''}`;
    return {
      ordinal: i + 1,
      label,
      startPosition: start,
      endPosition: end,
      startEventIndex: points[start].eventIndex,
      endEventIndex: points[end].eventIndex,
      count: end - start + 1,
      firstRecordedAtMs: points[start].recordedAtMs,
      lastRecordedAtMs: points[end].recordedAtMs,
      eventTypeCounts: eventTypeCounts(types.slice(start, end + 1)),
      // Filled in by computeDuplicates once all blocks are known.
      duplicateCount: 0,
      overlaps: [],
    };
  });
};

// Build the detail + context window for a selected event_index. `ordered` is the
// full log in event_index order and `blocks` the already-computed blocks.
const buildSelected = (
  ordered: ReadonlyArray<StoredDomainEvent>,
  blocks: ReadonlyArray<Block>,
  requestedIndex: number
): SelectedEvent => {
  const position = ordered.findIndex(e => e.event_index === requestedIndex);
  if (position === -1) {
    return {
      requestedIndex,
      found: false,
      window: [],
      detailJson: null,
      blockLabel: null,
    };
  }
  const from = Math.max(0, position - WINDOW);
  const to = Math.min(ordered.length - 1, position + WINDOW);
  const window = ordered.slice(from, to + 1).map(event => ({
    eventIndex: event.event_index,
    type: event.type,
    recordedAtMs: event.recordedAt.getTime(),
    isSelected: event.event_index === requestedIndex,
  }));
  const block = blocks.find(
    b =>
      position >= b.startPosition && position <= b.endPosition
  );
  return {
    requestedIndex,
    found: true,
    window,
    detailJson: JSON.stringify(ordered[position], null, 2),
    blockLabel: block ? block.label : null,
  };
};

// Pure timeline analysis: events -> the detected ordering structure (seams,
// blocks, structural regions, corroborated boundaries, duplicate overlaps). No
// I/O and no request params, so it is unit-testable in isolation (see tests).
type TimelineAnalysis = {
  ordered: ReadonlyArray<StoredDomainEvent>;
  totalEvents: number;
  points: ReadonlyArray<EventPoint>;
  blocks: ReadonlyArray<Block>;
  seamPositions: ReadonlyArray<number>;
  precisionRuns: ReadonlyArray<Region>;
  densityRuns: ReadonlyArray<Region>;
  bulkTypeRuns: ReadonlyArray<Region>;
  boundaries: ReadonlyArray<DetectedBoundary>;
  minRecordedAtMs: number;
  maxRecordedAtMs: number;
};

export const analyzeTimeline = (
  events: ReadonlyArray<StoredDomainEvent>
): TimelineAnalysis => {
        // getAllEvents returns rows in event_index order already; sort defensively
        // so the analysis never depends on query ordering.
        const ordered = [...events].sort(
          (a, b) => a.event_index - b.event_index
        );
        const points: EventPoint[] = ordered.map((event, position) => ({
          position,
          eventIndex: event.event_index,
          recordedAtMs: event.recordedAt.getTime(),
        }));
        const types = ordered.map(event => event.type);
        const n = points.length;

        // Signal 1: seams - recordedAt steps backward (unambiguous, trusted).
        const seamPositions: number[] = [];
        for (let i = 1; i < n; i++) {
          if (points[i].recordedAtMs < points[i - 1].recordedAtMs) {
            seamPositions.push(i);
          }
        }

        // Signal 2: whole-second ("external import") regions - robust structural
        // signal. A run of >=1000ms-aligned timestamps is import data.
        const toRegion = (run: {
          start: number;
          end: number;
          label: string;
        }): Region => ({
          startPosition: run.start,
          endPosition: run.end,
          startEventIndex: points[run.start].eventIndex,
          endEventIndex: points[run.end].eventIndex,
          count: run.end - run.start + 1,
          label: run.label === 'ws' ? '' : run.label,
        });
        const precisionRuns = homogeneousRuns(
          n,
          position => (points[position].recordedAtMs % 1000 === 0 ? 'ws' : null),
          PRECISION_MIN_RUN
        ).map(toRegion);

        // Signal 3: burst density - a dump of many events at one instant. A
        // block-defining signal; the density margin over live data is huge.
        const densityRuns = burstRuns(
          points.map(p => p.recordedAtMs),
          DENSITY_MIN_RUN,
          DENSITY_MAX_SPAN_MS
        ).map(toRegion);

        // Informational: long single-type runs (bulk operations). Shown but not
        // used as block boundaries - bulk operations occur in live data too.
        const bulkTypeRuns = homogeneousRuns(
          n,
          position => types[position],
          BULK_TYPE_MIN_RUN
        ).map(toRegion);

        // Actor tag per event, for the homogeneity check below.
        const actors = ordered.map(event => event.actor.tag as string);

        // A density edge is only trustworthy if the dump is homogeneous right up
        // to it - i.e. no genuine activity was folded into its tail/head. Genuine
        // activity shows up as a `user` actor (a human; dumps are system/token
        // only) or a foreign event type. Checking the boundary GAP does not work:
        // a dump grows until it hits a gap, so same-day events get folded in
        // BEFORE the gap and the gap is large either way.
        const majorTypesOf = (s: number, e: number): Set<string> => {
          const counts = new Map<string, number>();
          for (let j = s; j <= e; j++) {
            counts.set(types[j], (counts.get(types[j]) ?? 0) + 1);
          }
          const total = e - s + 1;
          const major = new Set<string>();
          for (const [type, count] of counts) {
            if (count / total >= 0.05) major.add(type);
          }
          return major;
        };
        const dominantTypeOf = (s: number, e: number): string => {
          const counts = new Map<string, number>();
          for (let j = s; j <= e; j++) {
            counts.set(types[j], (counts.get(types[j]) ?? 0) + 1);
          }
          let best: string = types[s];
          let bestCount = 0;
          for (const [type, count] of counts) {
            if (count > bestCount) {
              best = type;
              bestCount = count;
            }
          }
          return best;
        };
        // Clean = the near-edge window carries no human (`user`) activity and its
        // dominant type is one the dump is genuinely made of (not a foreign type
        // folded in).
        const edgeClean = (
          regionStart: number,
          regionEnd: number,
          windowStart: number,
          windowEnd: number
        ): boolean => {
          for (let j = windowStart; j <= windowEnd; j++) {
            if (actors[j] === 'user') return false;
          }
          return majorTypesOf(regionStart, regionEnd).has(
            dominantTypeOf(windowStart, windowEnd)
          );
        };

        type Edge = {position: number; signal: SignalKind; clean: boolean};
        const raw: Edge[] = [
          ...seamPositions.map(position => ({
            position,
            signal: 'seam' as const,
            clean: true,
          })),
          ...precisionRuns.flatMap(region =>
            [region.startPosition, region.endPosition + 1]
              .filter(position => position > 0 && position < n)
              .map(position => ({
                position,
                signal: 'precision' as const,
                clean: true,
              }))
          ),
          ...densityRuns.flatMap((region): Edge[] => {
            const s = region.startPosition;
            const e = region.endPosition;
            const w = HOMOGENEITY_WINDOW;
            const edges: Edge[] = [];
            if (s > 0 && s < n) {
              edges.push({
                position: s,
                signal: 'density',
                clean: edgeClean(s, e, s, Math.min(e, s + w - 1)),
              });
            }
            if (e + 1 > 0 && e + 1 < n) {
              edges.push({
                position: e + 1,
                signal: 'density',
                clean: edgeClean(s, e, Math.max(s, e - w + 1), e),
              });
            }
            return edges;
          }),
        ].sort((a, b) => a.position - b.position);

        // Merge coincident edges. A boundary is corroborated if any of its edges
        // is "clean" - seams/precision always are; a density edge is clean only
        // when its dump tail/head is homogeneous.
        const merged: Array<{
          position: number;
          signals: Set<SignalKind>;
          corroborated: boolean;
          densityPresent: boolean;
          densityClean: boolean;
        }> = [];
        for (const edge of raw) {
          const isDensityClean = edge.signal === 'density' && edge.clean;
          const last = merged[merged.length - 1];
          if (last && edge.position - last.position <= MERGE_TOLERANCE) {
            last.signals.add(edge.signal);
            last.corroborated = last.corroborated || edge.clean;
            last.densityPresent =
              last.densityPresent || edge.signal === 'density';
            last.densityClean = last.densityClean || isDensityClean;
          } else {
            merged.push({
              position: edge.position,
              signals: new Set([edge.signal]),
              corroborated: edge.clean,
              densityPresent: edge.signal === 'density',
              densityClean: isDensityClean,
            });
          }
        }
        const boundaries: DetectedBoundary[] = merged.map(m => ({
          eventIndex: points[m.position].eventIndex,
          signals: [...m.signals],
          corroborated: m.corroborated,
          densityHomogeneous: m.densityPresent ? m.densityClean : null,
        }));

        const baseBlocks = detectBlocks(
          points,
          types,
          merged.map(m => m.position),
          seamPositions
        );
        // Byte-identical duplicate detection (O(n) hash-grouping) - surfaces
        // e.g. block 2 being wholly contained in block 3a.
        const dup = computeDuplicates(ordered, baseBlocks);
        const blocks: ReadonlyArray<Block> = baseBlocks.map((block, i) => ({
          ...block,
          duplicateCount: dup.duplicateCount[i],
          overlaps: dup.overlaps[i],
        }));
        // reduce rather than Math.min(...) - the log has tens of thousands of
        // events and spreading that many args is needless risk.
        const minRecordedAtMs = points.reduce(
          (min, p) => (p.recordedAtMs < min ? p.recordedAtMs : min),
          points.length > 0 ? points[0].recordedAtMs : 0
        );
        const maxRecordedAtMs = points.reduce(
          (max, p) => (p.recordedAtMs > max ? p.recordedAtMs : max),
          points.length > 0 ? points[0].recordedAtMs : 0
        );
        return {
          ordered,
          totalEvents: points.length,
          points,
          blocks,
          seamPositions,
          precisionRuns,
          densityRuns,
          bulkTypeRuns,
          boundaries,
          minRecordedAtMs,
          maxRecordedAtMs,
        };
};

export const constructViewModel =
  (deps: Dependencies, selectedIndex: O.Option<number>, truncate: boolean) =>
  (user: User): TE.TaskEither<FailureWithStatus, ViewModel> =>
    pipe(
      mustBeSuperuser(deps.sharedReadModel, user),
      TE.chainW(() => deps.getAllEvents()),
      TE.map((events): ViewModel => {
        const {ordered, ...analysis} = analyzeTimeline(events);
        return {
          ...analysis,
          truncate,
          selected: O.isSome(selectedIndex)
            ? buildSelected(ordered, analysis.blocks, selectedIndex.value)
            : null,
        };
      }),
      TE.mapLeft((failure): FailureWithStatus => failure)
    );
