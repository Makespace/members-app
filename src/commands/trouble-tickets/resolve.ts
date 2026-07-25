import {constructEvent} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {Command} from '../command';
import {failureWithStatus} from '../../types/failure-with-status';
import {isTicketTrainerOrOwner} from './authorization';

const codec = t.strict({
  ticketId: tt.UUID,
  summary: tt.NonEmptyString,
});

type ResolveTroubleTicket = t.TypeOf<typeof codec>;

// Resolve a ticket, recording a summary of what was done.
const process: Command<ResolveTroubleTicket>['process'] = input =>
  pipe(
    input.rm.troubleTickets.getById(input.command.ticketId),
    TE.fromOption(() =>
      failureWithStatus(
        'The requested trouble ticket does not exist',
        StatusCodes.NOT_FOUND
      )()
    ),
    TE.map(() =>
      O.some(
        constructEvent('TroubleTicketResolved')({
          ticketId: input.command.ticketId,
          summary: input.command.summary,
          actor: input.command.actor,
        })
      )
    )
  );

export const resolve: Command<ResolveTroubleTicket> = {
  process,
  decode: codec.decode,
  isAuthorized: isTicketTrainerOrOwner,
};
