import {faker} from '@faker-js/faker';
import {sql} from 'drizzle-orm';
import {advanceTo} from 'jest-date-mock';
import {NonEmptyString, UUID} from 'io-ts-types';
import {TroubleTicketDataTable} from '../../src/sync-worker/google/sheet-data-table';
import {
  backfillTroubleTicketTimeline,
  planTroubleTicketBackfill,
} from '../../src/trouble-tickets/backfill-timeline';
import {TestFramework, initTestFramework} from '../read-models/test-framework';

describe('trouble ticket timeline backfill', () => {
  let framework: TestFramework;
  const sheetId = faker.string.alphanumeric(20);
  const areaId = faker.string.uuid() as UUID;

  const ticketRow = (
    rowIndex: number,
    submittedAt: Date,
    issue: string
  ): TroubleTicketDataTable['rows'][0] => ({
    sheet_id: sheetId,
    sheet_name: 'Form Responses 1',
    row_index: rowIndex,
    response_submitted: submittedAt,
    cached_at: new Date('2026-01-02T00:00:00.000Z'),
    submitted_email: 'member@example.com',
    submitted_equipment: null,
    submitted_name: 'A Member',
    submitted_membership_number: 1234,
    submitted_response_json: JSON.stringify({
      'What error or issue did you encounter.  Please include events and observations about what actually happened.':
        issue,
    }),
  });

  beforeEach(async () => {
    framework = await initTestFramework();
    // Existing history to weave into: an area created "now".
    advanceTo(new Date('2025-06-01T00:00:00.000Z'));
    await framework.commands.area.create({
      id: areaId,
      name: faker.commerce.productName() as NonEmptyString,
    });
  });

  afterEach(() => framework.close());

  it('weaves historical tickets in at their submission time, before existing events', async () => {
    await framework.updateTroubleTicketCache(sheetId, [
      ticketRow(2, new Date('2021-05-30T13:50:30.000Z'), 'Ancient issue'),
    ]);

    const summary = await backfillTroubleTicketTimeline(
      framework.depsForCommands
    )();

    expect(summary).toMatchObject({inserted: 1});
    const events = await framework.getAllEvents();
    const ticketEvent = events.find(e => e.type === 'TroubleTicketCreated');
    const areaEvent = events.find(e => e.type === 'AreaCreated');
    expect(ticketEvent).toBeDefined();
    expect(areaEvent).toBeDefined();
    // The 2021 ticket must sit earlier in the log than the 2025 area event.
    expect(ticketEvent!.event_index).toBeLessThan(areaEvent!.event_index);
    // recordedAt is the historical submission time, not the run time.
    expect(new Date(String(ticketEvent!.recordedAt))).toEqual(
      new Date('2021-05-30T13:50:30.000Z')
    );
    // The projection sees the woven-in ticket after the rebuild's reset.
    await framework.sharedReadModel.asyncRefresh()();
    expect(framework.sharedReadModel.troubleTickets.getAll()).toHaveLength(1);
  });

  it('is idempotent - a second run rewrites nothing', async () => {
    await framework.updateTroubleTicketCache(sheetId, [
      ticketRow(2, new Date('2021-05-30T13:50:30.000Z'), 'Ancient issue'),
    ]);
    await backfillTroubleTicketTimeline(framework.depsForCommands)();

    const secondRun = await backfillTroubleTicketTimeline(
      framework.depsForCommands
    )();

    expect(secondRun).toMatchObject({inserted: 0});
  });

  it('dedups byte-identical rows within one batch', async () => {
    const submittedAt = new Date('2021-05-30T13:50:30.000Z');
    await framework.updateTroubleTicketCache(sheetId, [
      ticketRow(2, submittedAt, 'Same issue'),
      ticketRow(3, submittedAt, 'Same issue'),
    ]);

    const summary = await backfillTroubleTicketTimeline(
      framework.depsForCommands
    )();

    expect(summary).toMatchObject({inserted: 1});
  });

  it('scopes a canary run to submissions strictly before the given date', async () => {
    await framework.updateTroubleTicketCache(sheetId, [
      ticketRow(2, new Date('2021-05-30T13:50:30.000Z'), 'Old issue'),
      ticketRow(3, new Date('2025-03-26T22:47:01.000Z'), 'New issue'),
    ]);

    const canaryPlan = await planTroubleTicketBackfill(framework.depsForCommands)(
      new Date('2022-01-01T00:00:00.000Z')
    );
    expect(canaryPlan).toMatchObject({wouldInsert: 1, excludedByScope: 1});

    const canary = await backfillTroubleTicketTimeline(
      framework.depsForCommands
    )(new Date('2022-01-01T00:00:00.000Z'));
    expect(canary).toMatchObject({inserted: 1});

    // The rest weaves in on the next unscoped run.
    const rest = await backfillTroubleTicketTimeline(
      framework.depsForCommands
    )();
    expect(rest).toMatchObject({inserted: 1});
  });

  it('skips and counts cache rows with a NULL submission timestamp', async () => {
    // Older sync versions / abandoned sheet ids can leave rows with no
    // timestamp; the DDL has no NOT NULL. They must be reported, not crash
    // the run (this happened on prod's first dry-run).
    await framework.updateTroubleTicketCache(sheetId, [
      ticketRow(2, new Date('2021-05-30T13:50:30.000Z'), 'Good row'),
    ]);
    await framework.extDB.run(
      sql`INSERT INTO trouble_ticket_data (sheet_id, sheet_name, row_index, response_submitted, cached_at, submitted_response_json) VALUES ('stale-sheet', 'Form Responses 1', 3, NULL, 0, '{}')`
    );
    // A row written in an older storage format: TEXT date instead of epoch ms.
    await framework.extDB.run(
      sql`INSERT INTO trouble_ticket_data (sheet_id, sheet_name, row_index, response_submitted, cached_at, submitted_response_json) VALUES ('stale-sheet', 'Form Responses 1', 4, '2021-05-30T13:50:30.000Z', 0, '{}')`
    );

    const plan = await planTroubleTicketBackfill(framework.depsForCommands)();

    // The parseable TEXT row is imported (drizzle maps ISO text to a valid
    // Date); only the NULL row is skipped.
    expect(plan).toMatchObject({
      totalCandidates: 2,
      wouldInsert: 2,
      skippedNoTimestamp: 1,
    });
    // The diagnostics give a definitive storage-class breakdown and identify
    // the NULL rows, so the operator can tell dead rows from recoverable
    // older-format data.
    expect(plan.cacheDiagnostics.timestampStorageBreakdown).toEqual({
      integer: 1,
      text: 1,
      null: 1,
    });
    expect(plan.cacheDiagnostics.nullTimestampSample).toEqual([
      expect.objectContaining({sheetId: 'stale-sheet', rowIndex: 3}),
    ]);
    // Bounds check against wrong-epoch timestamps.
    expect(plan.oldestCandidate).toEqual(new Date('2021-05-30T13:50:30.000Z'));
    expect(plan.newestCandidate).toEqual(new Date('2021-05-30T13:50:30.000Z'));

    const summary = await backfillTroubleTicketTimeline(
      framework.depsForCommands
    )();
    expect(summary).toMatchObject({inserted: 2});
  });

  it('plans without writing (dry run)', async () => {
    await framework.updateTroubleTicketCache(sheetId, [
      ticketRow(2, new Date('2021-05-30T13:50:30.000Z'), 'Ancient issue'),
    ]);

    const plan = await planTroubleTicketBackfill(framework.depsForCommands)();

    expect(plan).toMatchObject({
      totalCandidates: 1,
      wouldInsert: 1,
      alreadyImported: 0,
      excludedByScope: 0,
    });
    expect(plan.sample).toHaveLength(1);
    expect(plan.sample[0].issue).toBe('Ancient issue');
    expect(
      await framework.getAllEventsByType('TroubleTicketCreated')
    ).toHaveLength(0);
  });
});
