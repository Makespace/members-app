import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {Command} from '../command';
import {isAdminOrSuperUser} from '../is-admin-or-super-user';
import {failureWithStatus} from '../../types/failure-with-status';

const codec = t.strict({
  eventId: tt.UUID,
  reason: tt.NonEmptyString,
});

type DeleteStoredEventCommand = t.TypeOf<typeof codec>;

const resource: Command<DeleteStoredEventCommand>['resource'] = command => ({
  type: 'StoredEventDeletion',
  id: command.eventId,
});

const process: Command<DeleteStoredEventCommand>['process'] = input =>
  pipe(
    input.deps,
    O.fromNullable,
    TE.fromOption(() =>
      failureWithStatus(
        'Delete stored event command requires dependencies',
        StatusCodes.INTERNAL_SERVER_ERROR
      )()
    ),
    TE.bindTo('deps'),
    TE.bind('deletedByMemberNumber', () =>
      input.command.actor.tag === 'user'
        ? TE.right(input.command.actor.user.memberNumber)
        : TE.left(
            failureWithStatus(
              'Delete stored event requires a logged-in user',
              StatusCodes.UNAUTHORIZED
            )()
          )
    ),
    TE.chain(({deps, deletedByMemberNumber}) =>
      pipe(
        deps.deleteStoredEvent(
          input.command.eventId,
          deletedByMemberNumber,
          input.command.reason
        ),
        TE.map(() => O.none)
      )
    )
  );

export const deleteStoredEventCommand: Command<DeleteStoredEventCommand> = {
  resource,
  process,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
