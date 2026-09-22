import * as TE from 'fp-ts/TaskEither';
import {faker} from '@faker-js/faker';
import {UUID} from 'io-ts-types';
import {constructEvent, Email} from '../../src/types';
import {Config} from '../../src/configuration';
import {DomainEvent} from '../../src/types/domain-event';
import {bulkQuietResolve} from '../../src/trouble-tickets/bulk-quiet-resolve';
import {notifyTroubleTicketChanges} from '../../src/sync-worker/notify_trouble_tickets';
import {getRightOrFail, systemActor} from '../helpers';
import {TestFramework, initTestFramework} from '../read-models/test-framework';

const CUTOFF = new Date('2026-01-01T00:00:00.000Z');

describe('bulkQuietResolve', () => {
  let framework: TestFramework;
  let sentEmails: Email[];

  const commit = async (event: DomainEvent) =>
    getRightOrFail(
      await framework.depsForCommands.commitEvent(
        framework.sharedReadModel.getCurrentEventIndex()
      )(event)()
    );

  const addTicket = async (submittedAt: string, title: string) => {
    const id = faker.string.uuid() as UUID;
    await commit(
      constructEvent('TroubleTicketCreated')({
        actor: systemActor(),
        id,
        rowHash: faker.string.hexadecimal({length: 64}),
        sheetId: 'sheet-1',
        submittedAt: new Date(submittedAt),
        submittedMemberNumber: null,
        submittedEmail: 'submitter@test.com',
        submittedName: 'Sam Submitter',
        submittedEquipment: null,
        otherEquipmentDetail: '',
        status: 'Broken',
        attempting: 'x',
        issue: title,
        steps: '',
      })
    );
    return id;
  };

  const deps = () => ({
    logger: framework.depsForCommands.logger,
    sharedReadModel: framework.sharedReadModel,
    commitEvent: framework.depsForCommands.commitEvent,
  });

  const statusOf = (id: UUID) => {
    const found = framework.sharedReadModel.troubleTickets
      .getAll()
      .find(ticket => ticket.id === id);
    return found?.status;
  };

  beforeEach(async () => {
    framework = await initTestFramework();
    sentEmails = [];
  });

  afterEach(() => {
    framework.close();
  });

  it('reports what it would close without writing anything, on a dry run', async () => {
    const old = await addTicket('2025-06-01T09:00:00.000Z', 'old one');
    await addTicket('2026-06-01T09:00:00.000Z', 'recent one');

    const summary = await bulkQuietResolve(deps())(CUTOFF, {dryRun: true});

    expect(summary.candidates).toBe(1);
    expect(summary.resolved).toBe(0);
    expect(summary.sample[0].title).toContain('old one');
    expect(statusOf(old)).toBe('Todo');
  });

  it('resolves only open tickets submitted before the cutoff', async () => {
    const old = await addTicket('2025-06-01T09:00:00.000Z', 'old one');
    const alsoOld = await addTicket('2024-02-03T09:00:00.000Z', 'older one');
    const recent = await addTicket('2026-06-01T09:00:00.000Z', 'recent one');

    const summary = await bulkQuietResolve(deps())(CUTOFF, {dryRun: false});

    expect(summary).toEqual(
      expect.objectContaining({candidates: 2, resolved: 2, failed: 0})
    );
    expect(statusOf(old)).toBe('Resolved');
    expect(statusOf(alsoOld)).toBe('Resolved');
    expect(statusOf(recent)).toBe('Todo');
  });

  it('is a no-op when run again', async () => {
    await addTicket('2025-06-01T09:00:00.000Z', 'old one');
    await bulkQuietResolve(deps())(CUTOFF, {dryRun: false});

    const second = await bulkQuietResolve(deps())(CUTOFF, {dryRun: false});

    expect(second).toEqual(
      expect.objectContaining({candidates: 0, resolved: 0, failed: 0})
    );
  });

  it('emails nobody: every resolve it writes is quiet', async () => {
    await addTicket('2025-06-01T09:00:00.000Z', 'old one');
    await addTicket('2024-02-03T09:00:00.000Z', 'older one');
    await bulkQuietResolve(deps())(CUTOFF, {dryRun: false});

    await notifyTroubleTicketChanges({
      logger: framework.depsForCommands.logger,
      sharedReadModel: framework.sharedReadModel,
      getAllEventsByType: framework.depsForCommands.getAllEventsByType,
      commitEvent: framework.depsForCommands.commitEvent,
      sendEmail: (email: Email) => {
        sentEmails.push(email);
        return TE.right('sent');
      },
      conf: {PUBLIC_URL: 'https://members.makespace.org'} as unknown as Config,
    });

    expect(sentEmails).toHaveLength(0);
  });
});
