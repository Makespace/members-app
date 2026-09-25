import * as t from 'io-ts';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {Dependencies} from '../../dependencies';
import {Actor} from '../../types';
import {SharedReadModel} from '../../read-models/shared-state';
import {
  failureWithStatus,
  FailureWithStatus,
} from '../../types/failure-with-status';
import {getInboxThread} from '../../read-models/external-state/gmail-inbox';
import {isManagementTeam} from '../authentication-helpers/is-management-team';

// The conversation as the page names it; what unarchiving takes, and the
// half of archiving that says which.
export const conversationCodec = t.strict({
  conversationId: t.string,
});

export type ConversationCommand = t.TypeOf<typeof conversationCodec>;

// Who may archive is who may read the mailbox, and that depends on which
// area is the management team's - configuration that isAuthorized cannot
// see. So the commands accept everyone there and refuse here, where the
// config is to hand, exactly as the page does.
export const managementOnly = (input: {
  command: ConversationCommand & {actor: Actor};
  rm: SharedReadModel;
  deps?: Dependencies;
}): TE.TaskEither<FailureWithStatus, Dependencies> =>
  pipe(
    input.deps,
    TE.fromNullable(
      failureWithStatus(
        'The mailbox is not available',
        StatusCodes.INTERNAL_SERVER_ERROR
      )()
    ),
    TE.filterOrElse(
      deps =>
        isManagementTeam(input.rm, deps.conf.MANAGEMENT_TEAM_AREA_ID)(
          input.command.actor
        ),
      () =>
        failureWithStatus(
          'Only the management team can change the mailbox',
          StatusCodes.FORBIDDEN
        )()
    )
  );

// Every message in the conversation, not just the one the link names: the
// conversation's id is its earliest message, which moves as the cache
// window does, so any one of them has to identify it later.
export const messageIdsOf = (
  deps: Dependencies,
  conversationId: string
): TE.TaskEither<FailureWithStatus, ReadonlyArray<string>> =>
  pipe(
    TE.tryCatch(
      () => getInboxThread(deps.extDB, conversationId),
      () =>
        failureWithStatus(
          'Failed to read the mailbox cache',
          StatusCodes.INTERNAL_SERVER_ERROR
        )()
    ),
    TE.map(messages => messages.map(message => message.gmailMessageId)),
    TE.filterOrElse(
      ids => ids.length > 0,
      () => failureWithStatus('No such conversation', StatusCodes.NOT_FOUND)()
    )
  );
