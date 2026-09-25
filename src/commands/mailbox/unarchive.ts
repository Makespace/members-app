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

// Brings an archived conversation back into view. A conversation that is
// not archived has nothing to bring back.
const process: Command<ConversationCommand>['process'] = input =>
  pipe(
    managementOnly(input),
    TE.chain(deps => messageIdsOf(deps, input.command.conversationId)),
    TE.map(gmailMessageIds => {
      const archived = input.rm.mailbox.archivedMessageIds();
      return gmailMessageIds.some(id => archived.has(id))
        ? O.some(
            constructEvent('MailboxConversationUnarchived')({
              gmailMessageIds: [...gmailMessageIds],
              actor: input.command.actor,
            })
          )
        : O.none;
    })
  );

export const unarchive: Command<ConversationCommand> = {
  process,
  decode: conversationCodec.decode,
  // See managementOnly.
  isAuthorized: () => true,
};
