import * as t from 'io-ts';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {UUID} from 'io-ts-types';
import {StatusCodes} from 'http-status-codes';
import {Command} from '../command';
import {constructEvent} from '../../types';
import {TicketPermission} from '../../types/trouble-ticket-permission';
import {failureWithStatus} from '../../types/failure-with-status';
import {isTicketOwner} from './authorization';

const codec = t.strict({ticketId: UUID, permission: TicketPermission});
type SetPermission = t.TypeOf<typeof codec>;

export const setPermission: Command<SetPermission> = {
  decode: codec.decode,
  isAuthorized: isTicketOwner,
  process: input => {
    // Also enforce here: applyCommand is used by callers outside HTTP.
    if (
      !isTicketOwner({
        actor: input.command.actor,
        rm: input.rm,
        deps: input.deps,
        input: input.command,
      })
    ) {
      return TE.left(
        failureWithStatus(
          'You cannot change this ticket’s visibility',
          StatusCodes.FORBIDDEN
        )()
      );
    }
    if (O.isNone(input.rm.troubleTickets.getById(input.command.ticketId))) {
      return TE.left(
        failureWithStatus('No such trouble ticket', StatusCodes.NOT_FOUND)()
      );
    }
    if (
      input.command.permission === 'manager' &&
      (!input.deps?.conf.MANAGEMENT_TEAM_AREA_ID ||
        O.isNone(
          input.rm.area.get(input.deps.conf.MANAGEMENT_TEAM_AREA_ID as UUID)
        ))
    ) {
      return TE.left(
        failureWithStatus(
          'The management team area is not configured',
          StatusCodes.BAD_REQUEST
        )()
      );
    }
    return TE.right(
      O.some(
        constructEvent('TroubleTicketPermissionSet')({
          ticketId: input.command.ticketId,
          permission: input.command.permission,
          actor: input.command.actor,
        })
      )
    );
  },
};
