import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {archive} from '../../../src/commands/mailbox/archive';
import {unarchive} from '../../../src/commands/mailbox/unarchive';
import {constructEvent, EmailAddress} from '../../../src/types';
import {Actor} from '../../../src/types/actor';
import {MailboxArchiveReason} from '../../../src/types/mailbox-archive-reason';
import {gmailMessageTable} from '../../../src/sync-worker/gmail/gmail-message-table';
import {getLeftOrFail, getRightOrFail, getSomeOrFail} from '../../helpers';
import {
  TestFramework,
  initTestFramework,
} from '../../read-models/test-framework';

// A two-message conversation in the cache, grouped by subject, whose id is
// its earliest message.
const CONVERSATION_ID = 'first-message';
const REPLY_ID = 'reply-message';

const cacheConversation = async (framework: TestFramework) => {
  const row = (id: string, subject: string, receivedAt: string) => ({
    gmail_message_id: id,
    gmail_thread_id: `thread-${id}`,
    mailbox: 'tickets@example.org',
    rfc822_message_id: `<${id}@example.org>`,
    from_address: 'A Member <member@example.com>',
    to_addresses: 'management@example.org',
    subject,
    received_at: new Date(receivedAt),
    snippet: null,
    body_text: 'Hello',
    body_html: null,
    attachments_json: '[]',
    label_ids: '[]',
    cached_at: new Date(),
  });
  await framework.extDB.insert(gmailMessageTable).values([
    row(CONVERSATION_ID, 'Room hire enquiry', '2026-09-23T09:00:00.000Z'),
    row(REPLY_ID, 'Re: Room hire enquiry', '2026-09-23T10:00:00.000Z'),
  ]);
};

describe('archiving a mailbox conversation', () => {
  let framework: TestFramework;
  let manager: Actor;
  let member: Actor;

  const asUser = (memberNumber: number): Actor => ({
    tag: 'user',
    user: {memberNumber, emailAddress: faker.internet.email() as EmailAddress},
  });

  const join = async (memberNumber: number) =>
    framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber,
      email: faker.internet.email() as EmailAddress,
      name: undefined,
      formOfAddress: undefined,
    });

  beforeEach(async () => {
    framework = await initTestFramework();
    await cacheConversation(framework);

    const managerNumber = faker.number.int({max: 100000});
    const memberNumber = managerNumber + 1;
    await join(managerNumber);
    await join(memberNumber);
    // With no management area configured in tests, super user is the way in.
    await framework.commands.superUser.declare({memberNumber: managerNumber});
    manager = asUser(managerNumber);
    member = asUser(memberNumber);
  });

  afterEach(() => {
    framework.close();
  });

  const runArchive = (
    actor: Actor,
    reason: MailboxArchiveReason = 'resolved',
    conversationId = CONVERSATION_ID
  ) =>
    archive.process({
      command: {conversationId, reason, actor},
      rm: framework.sharedReadModel,
      deps: framework.depsForCommands,
    })();

  const runUnarchive = (actor: Actor, conversationId = CONVERSATION_ID) =>
    unarchive.process({
      command: {conversationId, actor},
      rm: framework.sharedReadModel,
      deps: framework.depsForCommands,
    })();

  const alreadyArchived = () =>
    framework.insertIntoSharedReadModel(
      constructEvent('MailboxConversationArchived')({
        gmailMessageIds: [CONVERSATION_ID, REPLY_ID],
        reason: 'resolved',
        actor: manager,
      })
    );

  it('names every message of the conversation, so any of them identifies it later', async () => {
    const event = getSomeOrFail(getRightOrFail(await runArchive(manager)));

    expect(event).toMatchObject({
      type: 'MailboxConversationArchived',
      gmailMessageIds: [CONVERSATION_ID, REPLY_ID],
      reason: 'resolved',
      actor: manager,
    });
  });

  // The reason is the point: everything archived as "hide like this" is
  // the list to write the next noise rule from.
  it('records why, as given', async () => {
    const event = getSomeOrFail(
      getRightOrFail(await runArchive(manager, 'hide-similar'))
    );

    expect(event).toMatchObject({reason: 'hide-similar'});
  });

  it('is for the management team only', async () => {
    expect(getLeftOrFail(await runArchive(member)).status).toBe(403);
  });

  it('refuses a conversation that is not in the mailbox', async () => {
    expect(
      getLeftOrFail(await runArchive(manager, 'resolved', 'nope')).status
    ).toBe(404);
  });

  it('records nothing when the conversation is already archived', async () => {
    alreadyArchived();

    expect(getRightOrFail(await runArchive(manager))).toStrictEqual(O.none);
  });

  describe('and bringing it back', () => {
    it('records nothing when the conversation was never archived', async () => {
      expect(getRightOrFail(await runUnarchive(manager))).toStrictEqual(
        O.none
      );
    });

    it('names every message, so all of them come back together', async () => {
      alreadyArchived();

      const event = getSomeOrFail(getRightOrFail(await runUnarchive(manager)));

      expect(event).toMatchObject({
        type: 'MailboxConversationUnarchived',
        gmailMessageIds: [CONVERSATION_ID, REPLY_ID],
      });
    });

    it('is for the management team only', async () => {
      expect(getLeftOrFail(await runUnarchive(member)).status).toBe(403);
    });
  });
});
