import {faker} from '@faker-js/faker';
import {TroubleTicketDataTable} from '../../src/sync-worker/google/sheet-data-table';
import {runTroubleTicketIngest} from '../../src/trouble-tickets/ingest';
import {TestFramework, initTestFramework} from '../read-models/test-framework';

describe('runTroubleTicketIngest (going-forward poller)', () => {
  let framework: TestFramework;
  const sheetId = faker.string.alphanumeric(20);

  // Fixed response_submitted so the rowHash is deterministic across runs.
  const ticketRow = (
    rowIndex: number,
    memberNumber: number
  ): TroubleTicketDataTable['rows'][0] => ({
    sheet_id: sheetId,
    sheet_name: 'Form Responses 1',
    row_index: rowIndex,
    response_submitted: new Date('2026-01-01T00:00:00.000Z'),
    cached_at: new Date('2026-01-02T00:00:00.000Z'),
    submitted_email: `member${memberNumber}@example.com`,
    submitted_equipment: 'Metal Lathe',
    submitted_name: 'A Member',
    submitted_membership_number: memberNumber,
    submitted_response_json: JSON.stringify({
      "What's the status of the machine?": 'Down',
      'What error or issue did you encounter.  Please include events and observations about what actually happened.':
        `Issue from member ${memberNumber}`,
    }),
  });

  beforeEach(async () => {
    framework = await initTestFramework();
  });

  afterEach(() => framework.close());

  it('records a TroubleTicketCreated event per cached row, as the system actor', async () => {
    await framework.updateTroubleTicketCache(sheetId, [
      ticketRow(2, 1234),
      ticketRow(3, 5678),
    ]);

    const summary = await runTroubleTicketIngest(framework.depsForCommands)();

    expect(summary).toMatchObject({
      total: 2,
      created: 2,
      alreadyImported: 0,
      failed: 0,
    });
    const events = await framework.getAllEventsByType('TroubleTicketCreated');
    expect(events).toHaveLength(2);
    // Poller-generated events must be attributed to the system, not an admin.
    expect(events.map(e => e.actor)).toEqual([{tag: 'system'}, {tag: 'system'}]);
    // The historical submission time rides in the payload, not recordedAt.
    expect(events.map(e => e.submittedAt)).toEqual([
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-01-01T00:00:00.000Z'),
    ]);
  });

  it('is idempotent - a second run imports nothing new (dedup by rowHash)', async () => {
    await framework.updateTroubleTicketCache(sheetId, [ticketRow(2, 1234)]);
    await runTroubleTicketIngest(framework.depsForCommands)();

    const summary = await runTroubleTicketIngest(framework.depsForCommands)();

    expect(summary).toMatchObject({total: 1, created: 0, alreadyImported: 1});
    expect(
      await framework.getAllEventsByType('TroubleTicketCreated')
    ).toHaveLength(1);
  });

  it('survives a re-pull that shifts row indexes (hash excludes row_index)', async () => {
    await framework.updateTroubleTicketCache(sheetId, [ticketRow(2, 1234)]);
    await runTroubleTicketIngest(framework.depsForCommands)();

    // The whole sheet is re-pulled and rows shift down one.
    await framework.updateTroubleTicketCache(sheetId, [ticketRow(3, 1234)]);
    const summary = await runTroubleTicketIngest(framework.depsForCommands)();

    expect(summary).toMatchObject({total: 1, created: 0, alreadyImported: 1});
  });
});
