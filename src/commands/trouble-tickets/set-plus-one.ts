import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {StatusCodes} from 'http-status-codes';
import {Command} from '../command';
import {constructEvent} from '../../types';
import {failureWithStatus} from '../../types/failure-with-status';
import {allMemberNumbers} from '../../read-models/shared-state/return-types';
import {ticketVisibility} from '../../trouble-tickets/permission';

const codec = t.strict({
  ticketId: tt.UUID,
  plusOne: t.union([t.boolean, tt.BooleanFromString]),
});
type SetPlusOne = t.TypeOf<typeof codec>;

export const setPlusOne: Command<SetPlusOne> = {
  decode: codec.decode,
  isAuthorized: ({actor}) => actor.tag === 'user',
  process: ({command, rm, deps}) => {
    if (command.actor.tag !== 'user') {
      return TE.left(
        failureWithStatus('Log in to +1 a ticket', StatusCodes.FORBIDDEN)()
      );
    }
    const member = rm.members.getByMemberNumber(
      command.actor.user.memberNumber
    );
    if (O.isNone(member)) {
      return TE.left(
        failureWithStatus(
          'We do not know who you are',
          StatusCodes.UNAUTHORIZED
        )()
      );
    }
    const ticket = rm.troubleTickets.getById(command.ticketId);
    if (
      O.isNone(ticket) ||
      !ticketVisibility(
        rm,
        deps?.conf.MANAGEMENT_TEAM_AREA_ID ?? '',
        member.value
      )(ticket.value)
    ) {
      return TE.left(
        failureWithStatus('No such trouble ticket', StatusCodes.NOT_FOUND)()
      );
    }
    const alreadyPlusOne = ticket.value.plusOneMemberNumbers.some(number =>
      allMemberNumbers(member.value).includes(number)
    );
    return TE.right(
      alreadyPlusOne === command.plusOne
        ? O.none
        : O.some(
            constructEvent('TroubleTicketPlusOneSet')({
              ticketId: command.ticketId,
              memberNumber: member.value.memberNumber,
              plusOne: command.plusOne,
              actor: command.actor,
            })
          )
    );
  },
};
