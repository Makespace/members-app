import {constructEvent} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {Command} from '../command';
import {failureWithStatus} from '../../types/failure-with-status';
import {isAdminOrSuperUser} from '../authentication-helpers/is-admin-or-super-user';
import {assignableMembers} from './authorization';

const codec = t.strict({
  ticketId: tt.UUID,
  // From the form's member picker, so it arrives as a string.
  memberNumber: t.union([t.number, tt.NumberFromString]),
  // Optional message to the submitter; an absent or empty field means none.
  comment: tt.withFallback(t.string, ''),
});

type AssignTroubleTicketTo = t.TypeOf<typeof codec>;

// A super-user hands a ticket to somebody else. The event is the one a
// member records when they pick a ticket up themselves; it already says who
// the ticket went to and, separately, who did it. Idempotent: assigning
// somebody already on the ticket is a no-op.
const process: Command<AssignTroubleTicketTo>['process'] = input =>
  pipe(
    input.rm.troubleTickets.getById(input.command.ticketId),
    TE.fromOption(() =>
      failureWithStatus(
        'The requested trouble ticket does not exist',
        StatusCodes.NOT_FOUND
      )()
    ),
    TE.filterOrElse(
      () =>
        assignableMembers(input.rm, input.command.ticketId).some(
          member => member.memberNumber === input.command.memberNumber
        ),
      () =>
        failureWithStatus(
          'A ticket can only be assigned to an owner of its area or a super-user',
          StatusCodes.BAD_REQUEST
        )()
    ),
    TE.map(ticket =>
      ticket.assignedMemberNumbers.includes(input.command.memberNumber)
        ? O.none
        : O.some(
            constructEvent('TroubleTicketAssigned')({
              ticketId: input.command.ticketId,
              trainerMemberNumber: input.command.memberNumber,
              comment: input.command.comment.trim(),
              actor: input.command.actor,
            })
          )
    )
  );

export const assignTo: Command<AssignTroubleTicketTo> = {
  process,
  decode: codec.decode,
  // Only super-users for now.
  isAuthorized: isAdminOrSuperUser,
};
