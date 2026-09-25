import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';
import {createTicket} from '../../../src/commands/mailbox/create-ticket';
import {EmailAddress} from '../../../src/types';
import {Actor} from '../../../src/types/actor';
import {Dependencies} from '../../../src/dependencies';
import {gmailMessageTable} from '../../../src/sync-worker/gmail/gmail-message-table';
import {getLeftOrFail, getRightOrFail, getSomeOrFail} from '../../helpers';
import {
  TestFramework,
  initTestFramework,
} from '../../read-models/test-framework';

// A two-message conversation from a member whose address the app knows.
const FIRST_ID = 'first-message';
const REPLY_ID = 'reply-message';
const SENDER_EMAIL = 'member@example.com' as EmailAddress;
const SENDER = `"A Member" <${SENDER_EMAIL}>`;

const cacheConversation = async (framework: TestFramework) => {
  const row = (
    id: string,
    from: string,
    subject: string,
    receivedAt: string
  ) => ({
    gmail_message_id: id,
    gmail_thread_id: `thread-${id}`,
    mailbox: 'tickets@example.org',
    rfc822_message_id: `<${id}@example.org>`,
    from_address: from,
    to_addresses: 'management@example.org',
    subject,
    received_at: new Date(receivedAt),
    snippet: null,
    body_text: 'The gantry made a grinding noise.',
    body_html: null,
    attachments_json: '[]',
    label_ids: '[]',
    cached_at: new Date(),
  });
  await framework.extDB.insert(gmailMessageTable).values([
    row(FIRST_ID, SENDER, 'Laser cutter grinding', '2026-09-23T09:00:00.000Z'),
    row(
      REPLY_ID,
      'Another Member <other@example.com>',
      'Re: Laser cutter grinding',
      '2026-09-23T10:00:00.000Z'
    ),
  ]);
};

describe('creating a ticket from a mailbox conversation', () => {
  let framework: TestFramework;
  let deps: Dependencies;
  let manager: Actor;
  let member: Actor;
  const areaId = faker.string.uuid() as UUID;
  const senderMemberNumber = 4242;

  const asUser = (memberNumber: number): Actor => ({
    tag: 'user',
    user: {memberNumber, emailAddress: faker.internet.email() as EmailAddress},
  });

  const join = async (memberNumber: number, email?: EmailAddress) =>
    framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber,
      email: email ?? (faker.internet.email() as EmailAddress),
      name: undefined,
      formOfAddress: undefined,
    });

  beforeEach(async () => {
    framework = await initTestFramework();
    await cacheConversation(framework);
    await framework.commands.area.create({
      id: areaId,
      name: 'Management Team' as NonEmptyString,
    });

    const managerNumber = 1;
    const memberNumber = 2;
    await join(managerNumber);
    await join(memberNumber);
    await join(senderMemberNumber, SENDER_EMAIL);
    // With no management area owners set up, super user is the way in.
    await framework.commands.superUser.declare({memberNumber: managerNumber});
    manager = asUser(managerNumber);
    member = asUser(memberNumber);

    deps = {
      ...framework.depsForCommands,
      conf: {...framework.depsForCommands.conf, MANAGEMENT_TEAM_AREA_ID: areaId},
    };
  });

  afterEach(() => {
    framework.close();
  });

  const run = (
    actor: Actor,
    overrides: Partial<{
      conversationId: string;
      title: string;
      issue: string;
      steps: string;
    }> = {},
    withDeps: Dependencies = deps
  ) =>
    createTicket.process({
      command: {
        conversationId: FIRST_ID,
        title: 'Laser cutter grinding',
        issue: 'The gantry made a grinding noise.',
        steps: '',
        ...overrides,
        actor,
      },
      rm: framework.sharedReadModel,
      deps: withDeps,
    })();

  it('raises a ticket for the management team, from the email, without emailing anyone', async () => {
    const event = getSomeOrFail(getRightOrFail(await run(manager)));

    expect(event).toMatchObject({
      type: 'TroubleTicketCreated',
      source: 'email',
      areaId,
      title: 'Laser cutter grinding',
      issue: 'The gantry made a grinding noise.',
      mailboxConversationId: FIRST_ID,
      submittedEmail: SENDER_EMAIL,
      submittedName: 'A Member',
      submittedMemberNumber: senderMemberNumber,
      equipmentId: null,
      actor: manager,
    });
  });

  // The link may name any message of the conversation; the ticket is paired
  // to the conversation itself, by its earliest message.
  it('pairs the ticket to the conversation whichever message the link named', async () => {
    const event = getSomeOrFail(
      getRightOrFail(await run(manager, {conversationId: REPLY_ID}))
    );

    expect(event).toMatchObject({mailboxConversationId: FIRST_ID});
  });

  it('is for the management team only', async () => {
    expect(getLeftOrFail(await run(member)).status).toBe(403);
  });

  it('refuses a conversation that is not in the mailbox', async () => {
    expect(
      getLeftOrFail(await run(manager, {conversationId: 'nope'})).status
    ).toBe(404);
  });

  it('refuses when no management team area is configured', async () => {
    const failure = getLeftOrFail(
      await run(manager, {}, framework.depsForCommands)
    );

    expect(failure.status).toBe(500);
  });

  it('refuses when the configured area does not exist', async () => {
    const failure = getLeftOrFail(
      await run(manager, {}, {
        ...deps,
        conf: {...deps.conf, MANAGEMENT_TEAM_AREA_ID: faker.string.uuid()},
      })
    );

    expect(failure.status).toBe(500);
  });
});
