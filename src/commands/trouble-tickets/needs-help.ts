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
  whatTried: tt.NonEmptyString,
  whyDidntWork: tt.NonEmptyString,
});

type TroubleTicketNeedsHelp = t.TypeOf<typeof codec>;

// Flag that the actor tried but couldn't solve the ticket. Projection unassigns them so
// another trainer can pick it up.
const process: Command<TroubleTicketNeedsHelp>['process'] = input =>
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
        constructEvent('TroubleTicketNeedsHelp')({
          ticketId: input.command.ticketId,
          whatTried: input.command.whatTried,
          whyDidntWork: input.command.whyDidntWork,
          actor: input.command.actor,
        })
      )
    )
  );

export const needsHelp: Command<TroubleTicketNeedsHelp> = {
  process,
  decode: codec.decode,
  isAuthorized: isTicketTrainerOrOwner,
};
