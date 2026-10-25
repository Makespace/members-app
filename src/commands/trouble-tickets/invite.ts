import {constructEvent} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {Command} from '../command';
import {failureWithStatus} from '../../types/failure-with-status';
import {assignableMembers, isWorkingOnTicket} from './authorization';

const codec = t.strict({
  ticketId: tt.UUID,
  // From the form's member picker, so it arrives as a string.
  memberNumber: t.union([t.number, tt.NumberFromString]),
  // Optional note to the invitee; an absent or empty field means none.
  message: tt.withFallback(t.string, ''),
});

type InviteToTroubleTicket = t.TypeOf<typeof codec>;

// Somebody working a ticket asks another owner to help with it. The invitee
// is only asked: they join by accepting, which is assigning themselves.
// Asking somebody already on the ticket, or already asked, does nothing.
const process: Command<InviteToTroubleTicket>['process'] = input =>
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
          'A resolved ticket needs nobody else',
          StatusCodes.BAD_REQUEST
        )()
    ),
    TE.filterOrElse(
      () =>
        assignableMembers(input.rm, input.command.ticketId).some(
          member => member.memberNumber === input.command.memberNumber
        ),
      () =>
        failureWithStatus(
          "Only an owner of the ticket's area or a super-user can be invited",
          StatusCodes.BAD_REQUEST
        )()
    ),
    TE.map(ticket => {
      const alreadyAsked = input.rm.troubleTickets
        .getInvitations([input.command.ticketId])
        .some(
          invitation =>
            invitation.inviteeMemberNumber === input.command.memberNumber
        );
      return ticket.assignedMemberNumbers.includes(
        input.command.memberNumber
      ) || alreadyAsked
        ? O.none
        : O.some(
            constructEvent('TroubleTicketInvitationSent')({
              ticketId: input.command.ticketId,
              inviteeMemberNumber: input.command.memberNumber,
              message: input.command.message.trim(),
              actor: input.command.actor,
            })
          );
    })
  );

export const invite: Command<InviteToTroubleTicket> = {
  process,
  decode: codec.decode,
  isAuthorized: isWorkingOnTicket,
};
