import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {constructEvent} from '../../types';
import {Command} from '../command';
import {
  conversationCodec,
  ConversationCommand,
  managementOnly,
  messageIdsOf,
} from './conversation';

// Puts a conversation out of sight - the same effect as a noise rule hiding
// it, but by a manager's hand. Archiving what is already archived is nothing
// to record.
const process: Command<ConversationCommand>['process'] = input =>
  pipe(
    managementOnly(input),
    TE.chain(deps => messageIdsOf(deps, input.command.conversationId)),
    TE.map(gmailMessageIds => {
      const archived = input.rm.mailbox.archivedMessageIds();
      return gmailMessageIds.every(id => archived.has(id))
        ? O.none
        : O.some(
            constructEvent('MailboxConversationArchived')({
              gmailMessageIds: [...gmailMessageIds],
              actor: input.command.actor,
            })
          );
    })
  );

export const archive: Command<ConversationCommand> = {
  process,
  decode: conversationCodec.decode,
  // The real check needs configuration, which this cannot see - see
  // managementOnly, which every call passes through.
  isAuthorized: () => true,
};
