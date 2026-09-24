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
import {equipmentSlug, toSlug} from '../../templates/slug';

// The page can be pointed at one machine or one area - a QR code on the
// machine itself, or on an area's noticeboard - so that reporting a problem
// takes one tap and arrives already attached to the right thing.
type Focus = {
  kind: 'equipment' | 'area';
  // The real id, which is what tickets are matched against.
  id: string;
  // The readable form, for links this page builds.
  slug: string;
  name: string;
  // For equipment, the area it sits in, so the page can say where it is.
  areaName: O.Option<string>;
};

export type ViewModel = {
  focus: O.Option<Focus>;
  // Tickets not yet resolved: across Makespace, or within the focus when
  // there is one.
  active: number;
  // Of those, the ones this member reported.
  mine: number;
  // Owners and trainers get the counts they can act on.
  inMyAreas: O.Option<number>;
  onMyMachines: O.Option<number>;
  canSeeBoard: boolean;
};

export const constructViewModel =
  (deps: Dependencies, params: {equipmentId?: string; areaId?: string}) =>
  (user: User): TE.TaskEither<FailureWithStatus, ViewModel> => {
    const rm = deps.sharedReadModel;
    const areaNames = new Map(
      rm.area.getAllMinimal().map(area => [area.id as string, area.name])
    );
    // A sign carries a readable slug (wood-shop-band-saw); older codes and
    // links carry a uuid. Both resolve, so nothing already printed breaks.
    const allEquipment = rm.equipment.getAllMinimal();
    const equipment = pipe(
      O.fromNullable(params.equipmentId),
      O.chain(reference =>
        pipe(
          allEquipment.find(
            item =>
              item.id === reference ||
              equipmentSlug(
                areaNames.get(item.areaId as string) ?? '',
                item.name
              ) === reference.toLowerCase()
          ),
          O.fromNullable
        )
      )
    );
    // An unknown id is ignored rather than refused: a QR code outliving the
    // equipment it names should still let someone report a problem.
    const equipmentFocus: O.Option<Focus> = pipe(
      equipment,
      O.map(item => ({
        kind: 'equipment' as const,
        id: item.id as string,
        slug: equipmentSlug(
          areaNames.get(item.areaId as string) ?? '',
          item.name
        ),
        name: item.name,
        areaName: O.fromNullable(areaNames.get(item.areaId as string)),
      }))
    );
    const areaFocus: O.Option<Focus> = pipe(
      O.fromNullable(params.areaId),
      O.chain(reference =>
        pipe(
          [...areaNames.entries()].find(
            ([id, name]) =>
              id === reference || toSlug(name) === reference.toLowerCase()
          ),
          O.fromNullable,
          O.map(([id, name]) => ({
            kind: 'area' as const,
            id,
            slug: toSlug(name),
            name,
            areaName: O.none as O.Option<string>,
          }))
        )
      )
    );
    const focus: O.Option<Focus> = pipe(
      equipmentFocus,
      O.alt(() => areaFocus)
    );
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

        const allOpen = rm.troubleTickets
          .getAll()
          .filter(ticket => ticket.status !== 'Resolved');

        // With a focus, every count on the page is about that machine or
        // area; without one they are about Makespace as a whole.
        const open = pipe(
          focus,
          O.match(
            () => allOpen,
            current =>
              allOpen.filter(ticket =>
                current.kind === 'equipment'
                  ? ticket.equipmentId === current.id
                  : (ticket.equipmentId !== null
                      ? equipmentArea.get(ticket.equipmentId)
                      : ticket.areaId) === current.id
              )
          )
        );

        const areaOf = (ticket: (typeof open)[number]) =>
          ticket.equipmentId !== null
            ? (equipmentArea.get(ticket.equipmentId) ?? null)
            : ticket.areaId;

        return {
          focus,
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
