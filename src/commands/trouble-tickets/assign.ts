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
});

type AssignTroubleTicket = t.TypeOf<typeof codec>;

// A trainer assigns themselves to a ticket. Idempotent: assigning again is a no-op.
const process: Command<AssignTroubleTicket>['process'] = input =>
  pipe(
    input.rm.troubleTickets.getById(input.command.ticketId),
    TE.fromOption(() =>
      failureWithStatus(
        'The requested trouble ticket does not exist',
        StatusCodes.NOT_FOUND
      )()
    ),
    TE.chain(ticket => {
      if (input.command.actor.tag !== 'user') {
        return TE.left(
          failureWithStatus(
            'Only a logged-in member can assign themselves to a ticket',
            StatusCodes.FORBIDDEN
          )()
        );
      }
      const memberNumber = input.command.actor.user.memberNumber;
      return TE.right(
        ticket.assignedMemberNumbers.includes(memberNumber)
          ? O.none
          : O.some(
              constructEvent('TroubleTicketAssigned')({
                ticketId: input.command.ticketId,
                trainerMemberNumber: memberNumber,
                actor: input.command.actor,
              })
            )
      );
    })
  );

export const assign: Command<AssignTroubleTicket> = {
  process,
  decode: codec.decode,
  isAuthorized: isTicketTrainerOrOwner,
};
