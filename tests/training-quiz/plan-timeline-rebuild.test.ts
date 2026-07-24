import {
  ExistingRow,
  TimelineRow,
  planTimelineRebuild,
} from '../../src/training-quiz/plan-timeline-rebuild';

const existing = (oldIndex: number, recordedAtMs: number): ExistingRow => ({
  id: `existing-${oldIndex}`,
  eventType: 'SomethingHappened',
  payload: `{"type":"SomethingHappened","recordedAt":${recordedAtMs}}`,
  recordedAtMs,
  oldIndex,
});

const insert = (label: string, recordedAtMs: number): TimelineRow => ({
  id: `new-${label}`,
  eventType: 'TrainingQuizCompleted',
  payload: `{"type":"TrainingQuizCompleted","recordedAt":${recordedAtMs}}`,
  recordedAtMs,
});

describe('planTimelineRebuild', () => {
  describe('when there is nothing to insert', () => {
    it('reassigns contiguous indices in the existing order and maps each to itself', () => {
      const rows = [existing(1, 100), existing(2, 200), existing(3, 300)];

      const plan = planTimelineRebuild(rows, []);

      expect(plan.rows.map(r => r.id)).toStrictEqual([
        'existing-1',
        'existing-2',
        'existing-3',
      ]);
      expect(plan.rows.map(r => r.newIndex)).toStrictEqual([1, 2, 3]);
      expect(plan.remap).toStrictEqual([
        {oldIndex: 1, newIndex: 1},
        {oldIndex: 2, newIndex: 2},
        {oldIndex: 3, newIndex: 3},
      ]);
    });
  });

  describe('when a historical event belongs in the middle', () => {
    it('weaves it in by timestamp and shifts the tail down', () => {
      const rows = [existing(1, 100), existing(2, 200), existing(3, 300)];
      const inserts = [insert('mid', 250)];

      const plan = planTimelineRebuild(rows, inserts);

      expect(plan.rows.map(r => ({id: r.id, i: r.newIndex}))).toStrictEqual([
        {id: 'existing-1', i: 1},
        {id: 'existing-2', i: 2},
        {id: 'new-mid', i: 3},
        {id: 'existing-3', i: 4},
      ]);
      // existing-3 was at old index 3, now at 4; the rest are unchanged.
      expect(plan.remap).toStrictEqual([
        {oldIndex: 1, newIndex: 1},
        {oldIndex: 2, newIndex: 2},
        {oldIndex: 3, newIndex: 4},
      ]);
    });
  });

  describe('when a historical event predates the whole log', () => {
    it('places it first and shifts everything down by one', () => {
      const rows = [existing(1, 100), existing(2, 200)];
      const inserts = [insert('ancient', 50)];

      const plan = planTimelineRebuild(rows, inserts);

      expect(plan.rows.map(r => r.id)).toStrictEqual([
        'new-ancient',
        'existing-1',
        'existing-2',
      ]);
      expect(plan.remap).toStrictEqual([
        {oldIndex: 1, newIndex: 2},
        {oldIndex: 2, newIndex: 3},
      ]);
    });
  });

  describe('tie-breaking on identical timestamps', () => {
    it('keeps an existing event before a newly inserted one', () => {
      const rows = [existing(1, 100), existing(2, 200)];
      const inserts = [insert('tie', 200)];

      const plan = planTimelineRebuild(rows, inserts);

      expect(plan.rows.map(r => r.id)).toStrictEqual([
        'existing-1',
        'existing-2',
        'new-tie',
      ]);
    });

    it('preserves the given order among several inserts at the same timestamp', () => {
      const rows = [existing(1, 100)];
      const inserts = [insert('a', 150), insert('b', 150), insert('c', 150)];

      const plan = planTimelineRebuild(rows, inserts);

      expect(plan.rows.map(r => r.id)).toStrictEqual([
        'existing-1',
        'new-a',
        'new-b',
        'new-c',
      ]);
    });
  });

  describe('general invariants', () => {
    it('produces contiguous 1..M indices covering every row exactly once', () => {
      const rows = [existing(1, 100), existing(2, 300), existing(3, 500)];
      const inserts = [
        insert('x', 50),
        insert('y', 400),
        insert('z', 600),
      ];

      const plan = planTimelineRebuild(rows, inserts);

      expect(plan.rows).toHaveLength(6);
      expect(plan.rows.map(r => r.newIndex)).toStrictEqual([1, 2, 3, 4, 5, 6]);
      // recordedAt is non-decreasing across the rebuilt log.
      const times = plan.rows.map(r => r.recordedAtMs);
      expect([...times].sort((a, b) => a - b)).toStrictEqual(times);
      // every existing event is remapped exactly once.
      expect(plan.remap.map(r => r.oldIndex).sort()).toStrictEqual([1, 2, 3]);
    });
  });

  describe('preserves payload verbatim', () => {
    it('does not alter the stored payload of existing events', () => {
      const row: ExistingRow = {
        id: 'existing-1',
        eventType: 'SomethingHappened',
        payload: '{"type":"SomethingHappened","recordedAt":"2022-01-01T00:00:00.000Z","weird":"  spacing  "}',
        recordedAtMs: 1640995200000,
        oldIndex: 1,
      };

      const plan = planTimelineRebuild([row], []);

      expect(plan.rows[0].payload).toStrictEqual(row.payload);
    });
  });
});
