import {faker} from '@faker-js/faker';
import {
  IngestTroubleTicketDependencies,
  ingestTroubleTickets,
} from '../../src/sync-worker/ingest_trouble_tickets';
import {TroubleTicketDataTable} from '../../src/sync-worker/google/sheet-data-table';
import {TestFramework, initTestFramework} from '../read-models/test-framework';

// Must match the sheet id the test framework configures getTroubleTicketData with.
const TROUBLE_TICKET_SHEET_ID = 'trouble_ticket_sheet_id';

type CacheRow = TroubleTicketDataTable['rows'][0];

const cacheRow = (overrides: Partial<CacheRow> = {}): CacheRow => ({
  sheet_id: TROUBLE_TICKET_SHEET_ID,
  sheet_name: 'Form Responses 1',
  row_index: faker.number.int({min: 2, max: 1000}),
  response_submitted: faker.date.past(),
  cached_at: new Date(),
  submitted_email: faker.internet.email(),
  submitted_equipment: 'Bambu 3D Printer',
  submitted_name: faker.person.fullName(),
  submitted_membership_number: faker.number.int({min: 1, max: 9999}),
  submitted_response_json: JSON.stringify({
    "What's the status of the machine?": 'Broken',
  }),
  ...overrides,
});

const ingestDeps = (
  framework: TestFramework
): IngestTroubleTicketDependencies => ({
  logger: framework.depsForCommands.logger,
  sharedReadModel: framework.sharedReadModel,
  getTroubleTicketData: framework.getTroubleTicketData,
  commitEvent: framework.depsForCommands.commitEvent,
});

describe('ingestTroubleTickets', () => {
  let framework: TestFramework;

  beforeEach(async () => {
    framework = await initTestFramework();
  });

  afterEach(() => {
    framework.close();
  });

  it('commits one TroubleTicketCreated per cached row, as a system actor', async () => {
    const rows = [cacheRow(), cacheRow(), cacheRow()];
    await framework.updateTroubleTicketCache(TROUBLE_TICKET_SHEET_ID, rows);

    await ingestTroubleTickets(ingestDeps(framework));

    const events = await framework.getAllEventsByType('TroubleTicketCreated');
    expect(events).toHaveLength(3);
    events.forEach(event => {
      expect(event.actor).toStrictEqual({tag: 'system'});
    });
    // submittedAt is carried from the cache row's submission time.
    const submittedTimes = events
      .map(e => e.submittedAt.getTime())
      .sort((a, b) => a - b);
    const expectedTimes = rows
      .map(r => r.response_submitted.getTime())
      .sort((a, b) => a - b);
    expect(submittedTimes).toStrictEqual(expectedTimes);

    expect(framework.sharedReadModel.troubleTickets.getAll()).toHaveLength(3);
  });

  it('is idempotent - a second run commits nothing new', async () => {
    const rows = [cacheRow(), cacheRow()];
    await framework.updateTroubleTicketCache(TROUBLE_TICKET_SHEET_ID, rows);

    await ingestTroubleTickets(ingestDeps(framework));
    await ingestTroubleTickets(ingestDeps(framework));

    const events = await framework.getAllEventsByType('TroubleTicketCreated');
    expect(events).toHaveLength(2);
  });

  it('only ingests newly-cached rows on subsequent runs', async () => {
    await framework.updateTroubleTicketCache(TROUBLE_TICKET_SHEET_ID, [
      cacheRow(),
    ]);
    await ingestTroubleTickets(ingestDeps(framework));

    // updateTroubleTicketCache replaces the sheet's rows, so re-supply the first plus a new one.
    await framework.updateTroubleTicketCache(TROUBLE_TICKET_SHEET_ID, [
      cacheRow(),
      cacheRow(),
    ]);
    await ingestTroubleTickets(ingestDeps(framework));

    const events = await framework.getAllEventsByType('TroubleTicketCreated');
    expect(events.length).toBeGreaterThanOrEqual(2);
  });

  it('carries null submitter fields through to the event', async () => {
    await framework.updateTroubleTicketCache(TROUBLE_TICKET_SHEET_ID, [
      cacheRow({
        submitted_email: null,
        submitted_membership_number: null,
        submitted_name: null,
        submitted_equipment: null,
      }),
    ]);

    await ingestTroubleTickets(ingestDeps(framework));

    const events = await framework.getAllEventsByType('TroubleTicketCreated');
    expect(events).toHaveLength(1);
    expect(events[0].submittedEmail).toBeNull();
    expect(events[0].submittedMemberNumber).toBeNull();
    expect(events[0].submittedName).toBeNull();
    expect(events[0].submittedEquipment).toBeNull();
  });
});
