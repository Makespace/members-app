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
        const scope = toScope(
          equipmentById,
          areaNameById,
          viewer
        )(ticket);
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
