import {advanceTo, clear} from 'jest-date-mock';
import {faker} from '@faker-js/faker';
import {v4 as uuidv4} from 'uuid';
import {NonEmptyString, UUID} from 'io-ts-types';
import {Int} from 'io-ts';
import {constructEvent} from '../../src/types';
import {Actor} from '../../src/types/actor';
import {TimelineRow} from '../../src/training-quiz/plan-timeline-rebuild';
import {TestFramework, initTestFramework} from '../read-models/test-framework';

const MIGRATION_ACTOR: Actor = {tag: 'token', token: 'admin'};

// Build a historical quiz event as a raw timeline row, stamped so it is ordered
// at `completedAt` (exactly what the backfill orchestration does).
const quizTimelineRow = (completedAt: Date, rowHash: string): TimelineRow => {
  const event = {
    ...constructEvent('TrainingQuizCompleted')({
      trainingSheetId: 'sheet-1',
      completedAt,
      memberNumberProvided: 1234,
      emailProvided: null,
      score: 10,
      maxScore: 10,
      rowHash,
      actor: MIGRATION_ACTOR,
    }),
    recordedAt: completedAt,
  };
  return {
    id: uuidv4(),
    eventType: event.type,
    payload: JSON.stringify(event),
    recordedAtMs: completedAt.getTime(),
  };
};

describe('rebuildEventTimeline', () => {
  let framework: TestFramework;

  beforeEach(async () => {
    framework = await initTestFramework();
  });

  afterEach(() => {
    clear();
    framework.close();
  });

  it('weaves a historical event into the middle and re-points deletions', async () => {
    // Two existing events at known times: area-one early, area-two late.
    advanceTo(new Date('2022-01-01T00:00:00Z'));
    await framework.commands.area.create({
      id: uuidv4() as UUID,
      name: 'area-one' as NonEmptyString,
    });

    advanceTo(new Date('2022-03-01T00:00:00Z'));
    await framework.commands.area.create({
      id: uuidv4() as UUID,
      name: 'area-two' as NonEmptyString,
    });
    clear();

    // area-two is currently at index 2; capture its stored event id.
    const before = (
      await framework.eventStoreDb.execute(
        'SELECT id, event_index FROM events ORDER BY event_index ASC'
      )
    ).rows;
    expect(before).toHaveLength(2);
    expect(Number(before[1].event_index)).toBe(2);
    const areaTwoId = before[1].id as string;

    // Soft-delete area-two, recorded against its CURRENT index (2).
    await framework.depsForCommands.deleteEvent(2 as Int, 'oops', 1 as Int)();

    // Weave in a quiz completed BETWEEN the two areas (Feb 2022).
    const rowHash = faker.string.alphanumeric(64);
    const summary = await framework.depsForCommands.rebuildEventTimeline([
      quizTimelineRow(new Date('2022-02-01T00:00:00Z'), rowHash),
    ]);

    expect(summary).toStrictEqual({
      rewrote: true,
      inserted: 1,
      totalBefore: 2,
      totalAfter: 3,
    });

    // New chronological order: area-one @1, quiz @2, area-two @3.
    const after = (
      await framework.eventStoreDb.execute(
        'SELECT id, event_index, event_type FROM events ORDER BY event_index ASC'
      )
    ).rows;
    expect(
      after.map(r => [Number(r.event_index), r.event_type as string])
    ).toStrictEqual([
      [1, 'AreaCreated'],
      [2, 'TrainingQuizCompleted'],
      [3, 'AreaCreated'],
    ]);

    // area-two moved from index 2 to index 3.
    const areaTwoAfter = after.find(r => (r.id as string) === areaTwoId);
    expect(areaTwoAfter && Number(areaTwoAfter.event_index)).toBe(3);

    // CRITICAL (bucket A2): the deletion followed area-two to its new index.
    const deleted = (
      await framework.eventStoreDb.execute(
        'SELECT event_index FROM deleted_events'
      )
    ).rows;
    expect(deleted.map(r => Number(r.event_index))).toStrictEqual([3]);

    // Backups captured the pre-rewrite state (recoverable).
    const backup = (
      await framework.eventStoreDb.execute(
        'SELECT count(*) as c FROM events_backup'
      )
    ).rows;
    expect(Number(backup[0].c)).toBe(2);

    // The read model was rebuilt and now recognises the quiz as imported.
    expect(framework.sharedReadModel.trainingQuiz.hasRowHash(rowHash)).toBe(
      true
    );
  });

  it('is a no-op when there is nothing new to insert', async () => {
    advanceTo(new Date('2022-01-01T00:00:00Z'));
    await framework.commands.area.create({
      id: uuidv4() as UUID,
      name: 'only-area' as NonEmptyString,
    });
    clear();

    const summary = await framework.depsForCommands.rebuildEventTimeline([]);

    expect(summary).toStrictEqual({
      rewrote: false,
      inserted: 0,
      totalBefore: 1,
      totalAfter: 1,
    });

    // Log untouched; no rewrite happened.
    const events = (
      await framework.eventStoreDb.execute('SELECT event_index FROM events')
    ).rows;
    expect(events.map(r => Number(r.event_index))).toStrictEqual([1]);
  });
});
