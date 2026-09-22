import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {
  failureWithStatus,
  FailureWithStatus,
} from '../../types/failure-with-status';
import {User} from '../../types';
import {Dependencies} from '../../dependencies';
import {allMemberNumbers} from '../../read-models/shared-state/return-types';

export type ViewModel = {
  // Tickets not yet resolved, across Makespace.
  active: number;
  // Of those, the ones this member reported.
  mine: number;
  // Owners and trainers get the counts they can act on.
  inMyAreas: O.Option<number>;
  onMyMachines: O.Option<number>;
  canSeeBoard: boolean;
};

export const constructViewModel =
  (deps: Dependencies) =>
  (user: User): TE.TaskEither<FailureWithStatus, ViewModel> => {
    const rm = deps.sharedReadModel;
    return pipe(
      rm.members.getByMemberNumber(user.memberNumber),
      TE.fromOption(
        failureWithStatus('You are not logged in', StatusCodes.UNAUTHORIZED)
      ),
      TE.map(member => {
        const equipmentArea = new Map(
          rm.equipment
            .getAllMinimal()
            .map(item => [item.id as string, item.areaId as string])
        );
        const myAreas = new Set(member.ownerOf.map(area => area.id));
        const myMachines = new Set(
          member.trainerFor.map(trained => trained.equipment_id)
        );
        const myNumbers = allMemberNumbers(member);

        const open = rm.troubleTickets
          .getAll()
          .filter(ticket => ticket.status !== 'Resolved');

        const areaOf = (ticket: (typeof open)[number]) =>
          ticket.equipmentId !== null
            ? (equipmentArea.get(ticket.equipmentId) ?? null)
            : ticket.areaId;

        return {
          active: open.length,
          mine: open.filter(
            ticket =>
              ticket.submittedMemberNumber !== null &&
              myNumbers.includes(ticket.submittedMemberNumber)
          ).length,
          inMyAreas:
            myAreas.size === 0
              ? O.none
              : O.some(
                  open.filter(ticket => {
                    const area = areaOf(ticket);
                    return area !== null && myAreas.has(area);
                  }).length
                ),
          onMyMachines:
            myMachines.size === 0
              ? O.none
              : O.some(
                  open.filter(
                    ticket =>
                      ticket.equipmentId !== null &&
                      myMachines.has(ticket.equipmentId)
                  ).length
                ),
          canSeeBoard: member.isSuperUser || member.ownerOf.length > 0,
        };
      })
    );
  };
