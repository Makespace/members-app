import {constructEvent} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {Command} from '../command';
import {failureWithStatus} from '../../types/failure-with-status';
import {isTicketTrainer} from './authorization';

const codec = t.strict({
  ticketId: tt.UUID,
  whyParked: tt.NonEmptyString,
  pathToResolution: tt.NonEmptyString,
  intermediateActions: tt.NonEmptyString,
});

type ParkTroubleTicket = t.TypeOf<typeof codec>;

// Park a ticket that can't be solved right now, recording why and the path forward.
const process: Command<ParkTroubleTicket>['process'] = input =>
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
        constructEvent('TroubleTicketParked')({
          ticketId: input.command.ticketId,
          whyParked: input.command.whyParked,
          pathToResolution: input.command.pathToResolution,
          intermediateActions: input.command.intermediateActions,
          actor: input.command.actor,
        })
      )
    )
  );

export const park: Command<ParkTroubleTicket> = {
  process,
  decode: codec.decode,
  isAuthorized: isTicketTrainer,
};
