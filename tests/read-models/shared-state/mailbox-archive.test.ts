import {constructEvent} from '../../../src/types';
import {arbitraryActor} from '../../helpers';
import {TestFramework, initTestFramework} from '../test-framework';

describe('the archived mailbox conversations', () => {
  let framework: TestFramework;

  beforeEach(async () => {
    framework = await initTestFramework();
  });

  afterEach(() => {
    framework.close();
  });

  const archived = () =>
    [...framework.sharedReadModel.mailbox.archivedMessageIds()].sort();

  it('start empty', () => {
    expect(archived()).toEqual([]);
  });

  it('hold every message id an archive event names', () => {
    framework.insertIntoSharedReadModel(
      constructEvent('MailboxConversationArchived')({
        gmailMessageIds: ['m1', 'm2'],
        actor: arbitraryActor(),
      })
    );

    expect(archived()).toEqual(['m1', 'm2']);
  });

  it('are unchanged by archiving the same conversation twice', () => {
    for (let times = 0; times < 2; times++) {
      framework.insertIntoSharedReadModel(
        constructEvent('MailboxConversationArchived')({
          gmailMessageIds: ['m1'],
          actor: arbitraryActor(),
        })
      );
    }

    expect(archived()).toEqual(['m1']);
  });

  it('let a conversation go when it is unarchived, leaving the others', () => {
    framework.insertIntoSharedReadModel(
      constructEvent('MailboxConversationArchived')({
        gmailMessageIds: ['m1', 'm2'],
        actor: arbitraryActor(),
      })
    );
    framework.insertIntoSharedReadModel(
      constructEvent('MailboxConversationArchived')({
        gmailMessageIds: ['other'],
        actor: arbitraryActor(),
      })
    );
    framework.insertIntoSharedReadModel(
      constructEvent('MailboxConversationUnarchived')({
        gmailMessageIds: ['m1', 'm2'],
        actor: arbitraryActor(),
      })
    );

    expect(archived()).toEqual(['other']);
  });
});
