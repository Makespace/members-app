import * as O from 'fp-ts/Option';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {Command} from '../command';
import {isAdminOrSuperUser} from '../is-admin-or-super-user';
import {failureWithStatus} from '../../types/failure-with-status';
import {resource} from './resource';

const codec = t.strict({
  eventId: tt.UUID,
  reason: tt.NonEmptyString,
});

export type DeleteEventCommand = t.TypeOf<typeof codec>;

const process: Command<DeleteEventCommand>['process'] = input =>
  pipe(
    input.deps,
    O.fromNullable,
    TE.fromOption(() =>
      failureWithStatus(
        'Command dependencies were not provided',
        StatusCodes.INTERNAL_SERVER_ERROR
      )()
    ),
    TE.bind('existingEvent', deps => deps.getEventById(input.command.eventId)),
    TE.bind('deletedEvent', deps =>
      deps.getDeletedEventById(input.command.eventId)
    ),
    TE.chain(({existingEvent, deletedEvent, ...deps}) => {
      if (O.isNone(existingEvent)) {
        return TE.left(
          failureWithStatus('Event does not exist', StatusCodes.NOT_FOUND)()
        );
      }

      if (O.isSome(deletedEvent)) {
        return TE.right(O.none);
      }

      return pipe(
        deps.deleteEvent(
          input.command.eventId,
          input.command.actor,
          input.command.reason
        ),
        TE.map(() => O.none)
      );
    })
  );

export const deleteEventCommand: Command<DeleteEventCommand> = {
  process,
  resource,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
