import {constructEvent} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {Command} from '../command';
import {failureWithStatus} from '../../types/failure-with-status';

const codec = t.strict({
  notificationId: tt.UUID,
});

type DismissNotification = t.TypeOf<typeof codec>;

// A member dismisses a banner for themselves. Any logged-in member may do it
// (dismissing something not aimed at you is a harmless no-op visually), but
// non-dismissable notifications refuse.
const process: Command<DismissNotification>['process'] = input =>
  pipe(
    O.fromNullable(
      input.rm.notifications.getById(input.command.notificationId)
    ),
    TE.fromOption(
      failureWithStatus('No such notification', StatusCodes.NOT_FOUND)
    ),
    TE.filterOrElse(
      notification => notification.dismissable,
      () =>
        failureWithStatus(
          'This notification cannot be dismissed',
          StatusCodes.FORBIDDEN
        )()
    ),
    TE.chain(() =>
      input.command.actor.tag === 'user'
        ? TE.right(
            O.some(
              constructEvent('NotificationDismissed')({
                notificationId: input.command.notificationId,
                memberNumber: input.command.actor.user.memberNumber,
                actor: input.command.actor,
              })
            )
          )
        : TE.left(
            failureWithStatus(
              'Only members can dismiss notifications',
              StatusCodes.FORBIDDEN
            )()
          )
    )
  );

export const dismiss: Command<DismissNotification> = {
  process,
  decode: codec.decode,
  isAuthorized: () => true,
};
