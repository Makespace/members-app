import * as t from 'io-ts';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {constructEvent} from '../../types';
import {MailboxArchiveReason} from '../../types/mailbox-archive-reason';
import {Command} from '../command';
import {conversationCodec, managementOnly, messageIdsOf} from './conversation';

const codec = t.intersection([
  conversationCodec,
  t.strict({reason: MailboxArchiveReason}),
]);

type ArchiveCommand = t.TypeOf<typeof codec>;

// Puts a conversation out of sight, and says why - the same effect as a
// noise rule hiding it, but by a manager's hand. Archiving what is already
// archived is nothing to record.
const process: Command<ArchiveCommand>['process'] = input =>
  pipe(
    managementOnly(input),
    TE.chain(deps => messageIdsOf(deps, input.command.conversationId)),
    TE.map(gmailMessageIds => {
      const archived = input.rm.mailbox.archivedMessages();
      return gmailMessageIds.every(id => archived.has(id))
        ? O.none
        : O.some(
            constructEvent('MailboxConversationArchived')({
              gmailMessageIds: [...gmailMessageIds],
              reason: input.command.reason,
              actor: input.command.actor,
            })
          );
    })
  );

export const archive: Command<ArchiveCommand> = {
  process,
  decode: codec.decode,
  // The real check needs configuration, which this cannot see - see
  // managementOnly, which every call passes through.
  isAuthorized: () => true,
};
