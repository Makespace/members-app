import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import {
  failureWithStatus,
  FailureWithStatus,
} from '../../types/failure-with-status';
import {ViewModel, TroubleTicketView} from './view-model';
import {User} from '../../types';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {SharedReadModel} from '../../read-models/shared-state';
import {TroubleTicket} from '../../types/trouble-ticket';

const toView =
  (rm: SharedReadModel) =>
  (ticket: TroubleTicket): TroubleTicketView => ({
    id: ticket.id,
    title: ticket.title,
    status: ticket.status,
    submittedAt: ticket.submittedAt,
    submittedName: ticket.submittedName,
    submittedMemberNumber: ticket.submittedMemberNumber,
    submittedEmail: ticket.submittedEmail,
    equipmentName: ticket.equipmentId
      ? pipe(
          rm.equipment.get(ticket.equipmentId),
          O.map(equipment => equipment.name)
        )
      : O.none,
    rawEquipment: ticket.submittedEquipment,
    response: ticket.response,
    assignees: ticket.assignedMemberNumbers.map(memberNumber => ({
      memberNumber,
      name: pipe(
        rm.members.getByMemberNumber(memberNumber),
        O.chain(member => member.name)
      ),
    })),
  });

export const constructViewModel =
  (sharedReadModel: SharedReadModel) =>
  (user: User): TE.TaskEither<FailureWithStatus, ViewModel> =>
    pipe(
      sharedReadModel.members.getByMemberNumber(user.memberNumber),
      TE.fromOption(
        failureWithStatus(
          'Only super-users can see this page',
          StatusCodes.UNAUTHORIZED
        )
      ),
      TE.filterOrElse(
        loggedInMember => loggedInMember.isSuperUser,
        () =>
          failureWithStatus(
            'Only super-users can see this page',
            StatusCodes.FORBIDDEN
          )()
      ),
      TE.map(() => ({
        tickets: sharedReadModel.troubleTickets
          .getAll()
          .map(toView(sharedReadModel)),
      }))
    );
