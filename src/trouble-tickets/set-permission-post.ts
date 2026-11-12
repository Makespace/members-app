import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {getUserFromSession} from '../authentication';
import {setPermission} from '../commands/trouble-tickets/set-permission';
import {Dependencies} from '../dependencies';
import {formPost} from '../http/form-post';
import {ticketVisibility} from './permission';

// Choose the destination after the change is saved and the read model refreshed:
// an owner can choose Managers and thereby lose access to their own ticket.
export const setPermissionPost = (deps: Dependencies) =>
  formPost(deps, setPermission, req => {
    const input = setPermission.decode(req.body);
    const user = getUserFromSession(deps)(req.session);
    if (E.isRight(input) && O.isSome(user)) {
      const member = deps.sharedReadModel.members.getByMemberNumber(
        user.value.memberNumber
      );
      const ticket = deps.sharedReadModel.troubleTickets.getById(
        input.right.ticketId
      );
      if (
        O.isSome(member) &&
        O.isSome(ticket) &&
        ticketVisibility(
          deps.sharedReadModel,
          deps.conf.MANAGEMENT_TEAM_AREA_ID,
          member.value
        )(ticket.value)
      ) {
        return `/trouble-tickets/view/${encodeURIComponent(input.right.ticketId)}`;
      }
    }
    return '/trouble-tickets/board';
  });
