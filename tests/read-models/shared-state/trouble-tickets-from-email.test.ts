import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';
import {constructEvent} from '../../../src/types';
import {systemActor} from '../../helpers';
import {TestFramework, initTestFramework} from '../test-framework';

// A ticket raised from the mailbox says where it belongs and what it is
// called, rather than leaving both to be worked out from a form answer.
describe('a trouble ticket raised from the mailbox', () => {
  let framework: TestFramework;
  const areaId = faker.string.uuid() as UUID;

  const created = (over: Record<string, unknown> = {}) =>
    constructEvent('TroubleTicketCreated')({
      id: faker.string.uuid() as UUID,
      rowHash: faker.string.hexadecimal({length: 64}),
      sheetId: 'email',
      submittedAt: new Date('2026-09-23T09:00:00.000Z'),
      submittedMemberNumber: null,
      submittedEmail: 'member@example.com',
      submittedName: 'A Member',
      submittedEquipment: null,
      otherEquipmentDetail: '',
      status: '',
      attempting: '',
      issue: 'The gantry made a grinding noise.',
      steps: '',
      source: 'email',
      equipmentId: null,
      machine: '',
      areaId,
      title: 'Laser cutter grinding',
      mailboxConversationId: 'first-message',
      actor: systemActor(),
      ...over,
    });

  beforeEach(async () => {
    framework = await initTestFramework();
    await framework.commands.area.create({
      id: areaId,
      name: 'Management Team' as NonEmptyString,
    });
  });

  afterEach(() => {
    framework.close();
  });

  it('sits in the area the event names, under the title it gives', () => {
    const event = created();
    framework.insertIntoSharedReadModel(event);

    const [ticket] = framework.sharedReadModel.troubleTickets.getAll();
    expect(ticket).toMatchObject({
      id: event.id,
      areaId,
      equipmentId: null,
      title: 'Laser cutter grinding',
      mailboxConversationId: 'first-message',
      status: 'Todo',
    });
  });

  it('is found by the conversation it came from', () => {
    framework.insertIntoSharedReadModel(created());
    framework.insertIntoSharedReadModel(
      created({mailboxConversationId: 'another-conversation'})
    );

    const tickets =
      framework.sharedReadModel.troubleTickets.getByMailboxConversation(
        'first-message'
      );
    expect(tickets).toHaveLength(1);
    expect(tickets[0].title).toBe('Laser cutter grinding');
  });

  // The fields are new; every ticket before them keeps behaving as it did.
  it('leaves a ticket with none of this as it always was', () => {
    framework.insertIntoSharedReadModel(
      created({
        source: 'sheet',
        areaId: null,
        title: '',
        mailboxConversationId: '',
      })
    );

    const [ticket] = framework.sharedReadModel.troubleTickets.getAll();
    expect(ticket).toMatchObject({
      areaId: null,
      title: 'The gantry made a grinding noise.',
      mailboxConversationId: null,
    });
    expect(
      framework.sharedReadModel.troubleTickets.getByMailboxConversation('')
    ).toHaveLength(0);
  });
});
