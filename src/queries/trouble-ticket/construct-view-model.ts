import {pipe} from 'fp-ts/lib/function';
import * as TE from 'fp-ts/TaskEither';
import {StatusCodes} from 'http-status-codes';
import {Dependencies} from '../../dependencies';
import {User} from '../../types';
import {
  FailureWithStatus,
  failureWithStatus,
} from '../../types/failure-with-status';
import {TroubleTicketView} from '../trouble-tickets/view-model';
import {
  buildChangeLog,
  toScope,
  toView,
} from '../trouble-tickets/construct-view-model';
import {ticketsVisibleTo} from '../trouble-tickets/management-tickets';
import {allMemberNumbers} from '../../read-models/shared-state/return-types';

// One ticket, for its own page.
//
// The board is for owners and super-users, because it is the whole backlog.
// A single ticket is a narrower thing: whoever reported it is sent a link to
// it, and a link they cannot open is no link at all. So a reporter may read
// their own ticket without owning anything.
//
// What nobody reaches this way is a ticket they could not already see on the
// board - correspondence with the management team is filtered out before any
// of this, for everybody outside that team, reporter or not.
export const constructViewModel =
  (deps: Dependencies, ticketId: string) =>
  (user: User): TE.TaskEither<FailureWithStatus, TroubleTicketView> => {
    const rm = deps.sharedReadModel;
    // Whether a ticket exists is not something to confirm to somebody who may
    // not read it, so every refusal here looks the same from outside.
    const notFound = failureWithStatus(
      'No such trouble ticket',
      StatusCodes.NOT_FOUND
    );
    return pipe(
      rm.members.getByMemberNumber(user.memberNumber),
      TE.fromOption(
        failureWithStatus('We do not know who you are', StatusCodes.UNAUTHORIZED)
      ),
      TE.chain(viewer => {
        const ticket = ticketsVisibleTo(
          rm,
          deps.conf.MANAGEMENT_TEAM_AREA_ID,
          viewer
        ).find(candidate => candidate.id === ticketId);
        if (ticket === undefined) {
          return TE.left(notFound());
        }
        const equipmentById = new Map(
          rm.equipment.getAllMinimal().map(item => [item.id as string, item])
        );
        const areaNameById = new Map(
          rm.area.getAllMinimal().map(area => [area.id as string, area.name])
        );
        const scope = toScope(equipmentById, areaNameById, viewer)(ticket);
        // A member number can change; the ticket keeps the one it was raised
        // with, so an old number still counts as theirs.
        const theirs =
          (ticket.submittedMemberNumber !== null &&
            allMemberNumbers(viewer).includes(ticket.submittedMemberNumber)) ||
          (ticket.submittedEmail !== null &&
            ticket.submittedEmail === viewer.primaryEmailAddress);
        if (!viewer.isSuperUser && !scope.inMyOwnerArea && !theirs) {
          return TE.left(notFound());
        }
        return TE.right({
          ...toView(rm, viewer)(scope),
          changeLog: buildChangeLog(
            [...rm.troubleTickets.getChangeLog([ticket.id])],
            rm
          ),
        });
      })
    );
  };
