import {constructEvent} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {Command} from '../command';
import {failureWithStatus} from '../../types/failure-with-status';
import {isTicketOwner} from './authorization';

const codec = t.strict({
  ticketId: tt.UUID,
  update: tt.NonEmptyString,
});

type TroubleTicketPostUpdate = t.TypeOf<typeof codec>;

// Record progress on an open ticket without moving it on - as many times as
// there is something to say. A resolved ticket is finished, so there is
// nothing more to report on it.
const process: Command<TroubleTicketPostUpdate>['process'] = input =>
  pipe(
    input.rm.troubleTickets.getById(input.command.ticketId),
    TE.fromOption(() =>
      failureWithStatus(
        'The requested trouble ticket does not exist',
        StatusCodes.NOT_FOUND
      )()
    ),
    TE.filterOrElse(
      ticket => ticket.status !== 'Resolved',
      () =>
        failureWithStatus(
          'This ticket is resolved, so it cannot take any more updates',
          StatusCodes.BAD_REQUEST
        )()
    ),
    TE.map(() =>
      O.some(
        constructEvent('TroubleTicketUpdatePosted')({
          ticketId: input.command.ticketId,
          update: input.command.update,
          actor: input.command.actor,
        })
      )
    )
  );

export const postUpdate: Command<TroubleTicketPostUpdate> = {
  process,
  decode: codec.decode,
  isAuthorized: isTicketOwner,
};
