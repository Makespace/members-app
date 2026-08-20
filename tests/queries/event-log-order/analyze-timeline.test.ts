import {faker} from '@faker-js/faker';
import {Int} from 'io-ts';
import {NonEmptyString, UUID} from 'io-ts-types';
import {constructEvent} from '../../../src/types';
import {DomainEvent, StoredDomainEvent} from '../../../src/types/domain-event';
import {Actor} from '../../../src/types/actor';
import {systemActor, userActor} from '../../helpers';
import {analyzeTimeline} from '../../../src/queries/event-log-order/construct-view-model';

const HOUR = 3_600_000;
const MIN = 60_000;
const DAY = 86_400_000;
const BASE = Date.parse('2020-01-01T00:00:00.000Z'); // whole-second anchor

// Wrap a real DomainEvent as a StoredDomainEvent at a given event_index and
// recordedAt - the same fields the framework's insertIntoSharedReadModel adds,
// so no casts are needed and the shape is checked by the compiler. analyzeTimeline
// only reads event_index, recordedAt, type, actor and the payload, but a genuine
// event keeps the test honest.
const stored = (
  index: number,
  recordedAtMs: number,
  event: DomainEvent
): StoredDomainEvent => ({
  ...event,
  recordedAt: new Date(recordedAtMs),
  event_id: faker.string.uuid() as UUID,
  event_index: index as Int,
  deletedAt: null,
  deleteReason: null,
  markDeletedByMemberNumber: null,
});

// A generic filler event. Distinct id per call unless one is passed, so two with
// the same id + recordedAt are byte-identical (for the duplicate tests).
const area = (opts: {id?: UUID; actor?: Actor} = {}): DomainEvent =>
  constructEvent('AreaCreated')({
    id: opts.id ?? (faker.string.uuid() as UUID),
    name: 'Area' as NonEmptyString,
    actor: opts.actor ?? systemActor(),
  });

// `offsetMs: 500` forces millisecond precision so a run is NOT whole-second.
const series = (
  from: number,
  count: number,
  startMs: number,
  stepMs: number,
  opts: {offsetMs?: number; actor?: Actor} = {}
): StoredDomainEvent[] =>
  Array.from({length: count}, (_, i) =>
    stored(
      from + i,
      startMs + i * stepMs + (opts.offsetMs ?? 0),
      area({actor: opts.actor})
    )
  );

describe('analyzeTimeline', () => {
  describe('seams', () => {
    it('a chronological log has no seams and one block', () => {
      const a = analyzeTimeline([
        stored(1, BASE, area()),
        stored(2, BASE + DAY, area()),
        stored(3, BASE + 2 * DAY, area()),
      ]);
      expect(a.seamPositions).toEqual([]);
      expect(a.boundaries).toEqual([]);
      expect(a.blocks.map(b => b.label)).toEqual(['1']);
    });

    it('a backwards recordedAt step is a seam that splits into two blocks', () => {
      const a = analyzeTimeline([
        stored(1, BASE, area()),
        stored(2, BASE + DAY, area()),
        stored(3, BASE - 365 * DAY, area()), // steps back a year
        stored(4, BASE - 364 * DAY, area()),
      ]);
      expect(a.seamPositions).toEqual([2]);
      expect(a.boundaries).toHaveLength(1);
      expect(a.boundaries[0].eventIndex).toBe(3);
      expect(a.boundaries[0].signals).toEqual(['seam']);
      expect(a.boundaries[0].corroborated).toBe(true); // a seam is trusted alone
      expect(a.blocks.map(b => b.label)).toEqual(['1', '2']);
    });
  });

  describe('precision (whole-second import) signal', () => {
    it('detects an interior whole-second run and splits blocks at its edges', () => {
      const a = analyzeTimeline([
        ...series(1, 10, BASE, HOUR, {offsetMs: 500}), // millisecond
        ...series(11, 120, BASE + 100 * HOUR, HOUR), // whole-second run
        ...series(131, 10, BASE + 300 * HOUR, HOUR, {offsetMs: 500}), // millisecond
      ]);
      expect(a.precisionRuns).toHaveLength(1);
      expect(a.precisionRuns[0].startEventIndex).toBe(11);
      expect(a.precisionRuns[0].endEventIndex).toBe(130);
      // three blocks, all inside seam-block 1 => lettered
      expect(a.blocks.map(b => b.label)).toEqual(['1a', '1b', '1c']);
      const boundary = a.boundaries.find(b => b.eventIndex === 11);
      expect(boundary?.signals).toContain('precision');
      expect(boundary?.corroborated).toBe(true);
    });
  });

  describe('density (burst / dump) signal', () => {
    it('detects an interior burst of many events packed into < 1 day', () => {
      const a = analyzeTimeline([
        ...series(1, 10, BASE, DAY, {offsetMs: 500}), // sparse
        ...series(11, 220, BASE + 100 * DAY, MIN, {offsetMs: 500}), // 220 in ~3.6h
        ...series(231, 10, BASE + 200 * DAY, DAY, {offsetMs: 500}), // sparse
      ]);
      expect(a.densityRuns).toHaveLength(1);
      expect(a.densityRuns[0].startEventIndex).toBe(11);
      expect(a.densityRuns[0].endEventIndex).toBe(230);
    });

    it('corroborates a density edge only when the dump has no foreign actor in its tail', () => {
      // 220-event dump; optionally make one event near the END a `user` actor.
      const build = (tailActor: Actor) =>
        analyzeTimeline([
          ...series(1, 10, BASE, DAY, {offsetMs: 500}),
          ...Array.from({length: 220}, (_, i) =>
            stored(11 + i, BASE + 100 * DAY + i * MIN + 500, area({
              actor: i === 215 ? tailActor : systemActor(),
            }))
          ),
          ...series(231, 10, BASE + 200 * DAY, DAY, {offsetMs: 500}),
        ]);

      // homogeneous tail (all system) => the dump's trailing edge is trusted
      const clean = build(systemActor()).boundaries.find(
        b => b.eventIndex === 231
      );
      expect(clean?.densityHomogeneous).toBe(true);
      expect(clean?.corroborated).toBe(true);

      // a `user` actor folded into the tail => low confidence
      const smeared = build(userActor()).boundaries.find(
        b => b.eventIndex === 231
      );
      expect(smeared?.densityHomogeneous).toBe(false);
      expect(smeared?.corroborated).toBe(false);
    });
  });

  describe('duplicate / overlap detection', () => {
    it('reports byte-identical events shared between two blocks', () => {
      const R = Date.parse('2020-06-01T00:00:00.000Z');
      const dupId = faker.string.uuid() as UUID;
      const a = analyzeTimeline([
        stored(1, BASE, area()),
        stored(2, R, area({id: dupId})), // block 1
        stored(3, BASE - 365 * DAY, area()), // seam -> block 2
        stored(4, R, area({id: dupId})), // byte-identical twin of #2, in block 2
      ]);
      expect(a.blocks.map(b => b.label)).toEqual(['1', '2']);
      expect(a.blocks[0].duplicateCount).toBe(1);
      expect(a.blocks[0].overlaps).toEqual([{label: '2', count: 1}]);
      expect(a.blocks[1].overlaps).toEqual([{label: '1', count: 1}]);
    });

    it('does not flag events that differ only in recordedAt', () => {
      const id = faker.string.uuid() as UUID;
      const a = analyzeTimeline([
        stored(1, BASE, area({id})),
        stored(2, BASE + DAY, area({id})), // same payload, different time
      ]);
      expect(a.blocks[0].duplicateCount).toBe(0);
      expect(a.blocks[0].overlaps).toEqual([]);
    });
  });
});
