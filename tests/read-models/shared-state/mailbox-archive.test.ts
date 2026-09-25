import {constructEvent} from '../../../src/types';
import {MailboxArchiveReason} from '../../../src/types/mailbox-archive-reason';
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

  const archive = (
    gmailMessageIds: string[],
    reason: MailboxArchiveReason = 'resolved'
  ) =>
    framework.insertIntoSharedReadModel(
      constructEvent('MailboxConversationArchived')({
        gmailMessageIds,
        reason,
        actor: arbitraryActor(),
      })
    );

  const archived = () =>
    [...framework.sharedReadModel.mailbox.archivedMessages().entries()].sort();

  it('start empty', () => {
    expect(archived()).toEqual([]);
  });

  it('hold every message id an archive event names, with why', () => {
    archive(['m1', 'm2'], 'hide-similar');

    expect(archived()).toEqual([
      ['m1', 'hide-similar'],
      ['m2', 'hide-similar'],
    ]);
  });

  it('are unchanged by archiving the same conversation twice', () => {
    archive(['m1']);
    archive(['m1']);

    expect(archived()).toEqual([['m1', 'resolved']]);
  });

  it('let a conversation go when it is unarchived, leaving the others', () => {
    archive(['m1', 'm2']);
    archive(['other']);
    framework.insertIntoSharedReadModel(
      constructEvent('MailboxConversationUnarchived')({
        gmailMessageIds: ['m1', 'm2'],
        actor: arbitraryActor(),
      })
    );

    expect(archived()).toEqual([['other', 'resolved']]);
  });
});
