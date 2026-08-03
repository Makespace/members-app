import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';
import {SheetDataTable} from '../../src/sync-worker/google/sheet-data-table';
import {runQuizMigration} from '../../src/training-quiz/migrate';
import {TestFramework, initTestFramework} from '../read-models/test-framework';

describe('runQuizMigration (going-forward poller)', () => {
  let framework: TestFramework;
  const areaId = faker.string.uuid() as UUID;
  const equipmentId = faker.string.uuid() as UUID;
  const trainingSheetId = faker.string.alphanumeric(20);

  // Fixed completedAt so the rowHash is deterministic across runs.
  const quizRow = (
    rowIndex: number,
    memberNumber: number
  ): SheetDataTable['rows'][0] => ({
    sheet_id: trainingSheetId,
    sheet_name: 'Form responses 1',
    row_index: rowIndex,
    response_submitted: new Date('2026-01-01T00:00:00.000Z'),
    member_number_provided: memberNumber,
    email_provided: null,
    score: 10,
    max_score: 10,
    percentage: 100,
    cached_at: new Date('2026-01-02T00:00:00.000Z'),
  });

  beforeEach(async () => {
    framework = await initTestFramework();
    await framework.commands.area.create({
      id: areaId,
      name: faker.commerce.productName() as NonEmptyString,
    });
    await framework.commands.equipment.add({
      id: equipmentId,
      name: faker.commerce.productName() as NonEmptyString,
      areaId,
    });
    await framework.commands.equipment.trainingSheet({
      equipmentId,
      trainingSheetId,
    });
  });

  afterEach(() => framework.close());

  it('records a TrainingQuizCompleted event per cached row, as the system actor', async () => {
    await framework.updateTrainingSheetCache(trainingSheetId, [
      quizRow(2, 1234),
      quizRow(3, 5678),
    ]);

    const summary = await runQuizMigration(framework.depsForCommands)();

    expect(summary).toMatchObject({
      total: 2,
      created: 2,
      alreadyImported: 0,
      failed: 0,
    });
    const events = await framework.getAllEventsByType('TrainingQuizCompleted');
    expect(events).toHaveLength(2);
    // Poller-generated events must be attributed to the system, not an admin.
    expect(events.map(e => e.actor)).toEqual([{tag: 'system'}, {tag: 'system'}]);
  });

  it('is idempotent - a second run imports nothing new (dedup by rowHash)', async () => {
    await framework.updateTrainingSheetCache(trainingSheetId, [quizRow(2, 1234)]);
    await runQuizMigration(framework.depsForCommands)();

    const summary = await runQuizMigration(framework.depsForCommands)();

    expect(summary).toMatchObject({total: 1, created: 0, alreadyImported: 1});
    expect(
      await framework.getAllEventsByType('TrainingQuizCompleted')
    ).toHaveLength(1);
  });
});
