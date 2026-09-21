import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {UUID} from 'io-ts-types';
import {Actor} from '../../types';
import {SharedReadModel} from '../../read-models/shared-state';
import {isAdminOrSuperUser} from '../authentication-helpers/is-admin-or-super-user';
import {allMemberNumbers} from '../../read-models/shared-state/return-types';
import {isEquipmentOwner} from '../authentication-helpers/is-equipment-owner';

// True when the actor owns the given area (user actors only - admin/super is
// checked separately by the callers).
const isAreaOwner = (actor: Actor, rm: SharedReadModel, areaId: UUID): boolean =>
  actor.tag === 'user' &&
  pipe(
    rm.area.get(areaId),
    O.match(
      () => false,
      area =>
        area.owners.some(owner =>
          allMemberNumbers(owner).includes(actor.user.memberNumber)
        )
    )
  );

// The area a ticket belongs to: its equipment's area when a machine is
// resolved, else its directly-mapped area.
const ticketAreaId = (rm: SharedReadModel, ticketId: UUID): O.Option<UUID> =>
  pipe(
    rm.troubleTickets.getById(ticketId),
    O.chain(ticket =>
      ticket.equipmentId !== null
        ? pipe(
            rm.equipment.get(ticket.equipmentId),
            O.map(equipment => equipment.area.id)
          )
        : O.fromNullable(ticket.areaId)
    )
  );

// Status transitions (assign / resolve / park / needs-help), like title edits, require
// ownership of the ticket's equipment's area - or admin/super user. All owners are
// maintainers (trainers are the subset who also train, and must be owners anyway), so
// area ownership is the right bar for working a ticket. An Unassigned ticket (no
// resolved equipment) has no area, so only an admin/super user can act until someone
// sets its equipment. If maintainer/trainer roles ever diverge per equipment, this is
// the seam to split.
export const isTicketOwner = (input: {
  actor: Actor;
  rm: SharedReadModel;
  input: {ticketId: UUID};
}): boolean =>
  isAdminOrSuperUser({actor: input.actor, rm: input.rm}) ||
  pipe(
    ticketAreaId(input.rm, input.input.ticketId),
    O.match(
      () => false,
      areaId => isAreaOwner(input.actor, input.rm, areaId)
    )
  );

// Setting a ticket's equipment requires ownership of either the current or the target
// equipment's area (or admin/super user) - so an owner can pull a ticket onto equipment
// they own, or move one off their own equipment.
export const canSetTicketEquipment = (input: {
  actor: Actor;
  rm: SharedReadModel;
  input: {ticketId: UUID; equipmentId: UUID | null};
}): boolean => {
  if (isAdminOrSuperUser({actor: input.actor, rm: input.rm})) {
    return true;
  }
  const ownsTarget =
    input.input.equipmentId !== null &&
    isEquipmentOwner({
      actor: input.actor,
      rm: input.rm,
      input: {equipmentId: input.input.equipmentId},
    });
  const ownsCurrent = pipe(
    ticketAreaId(input.rm, input.input.ticketId),
    O.match(
      () => false,
      areaId => isAreaOwner(input.actor, input.rm, areaId)
    )
  );
  return ownsTarget || ownsCurrent;
};
