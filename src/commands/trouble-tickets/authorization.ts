import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {UUID} from 'io-ts-types';
import {Actor} from '../../types';
import {SharedReadModel} from '../../read-models/shared-state';
import {EquipmentId} from '../../types/equipment-id';
import {isAdminOrSuperUser} from '../authentication-helpers/is-admin-or-super-user';
import {isEquipmentTrainer} from '../authentication-helpers/is-equipment-trainer';
import {isEquipmentOwner} from '../authentication-helpers/is-equipment-owner';

const ticketEquipmentId = (
  rm: SharedReadModel,
  ticketId: UUID
): O.Option<EquipmentId> =>
  pipe(
    rm.troubleTickets.getById(ticketId),
    O.chain(ticket => O.fromNullable(ticket.equipmentId))
  );

// Status transitions (assign / resolve / park / needs-help) require the actor to be a
// trainer on the ticket's equipment - or an admin/super user. An Unassigned ticket (no
// resolved equipment) has no trainers, so only an admin/super user can act until an owner
// sets its equipment.
export const isTicketTrainer = (input: {
  actor: Actor;
  rm: SharedReadModel;
  input: {ticketId: UUID};
}): boolean =>
  isAdminOrSuperUser({actor: input.actor, rm: input.rm}) ||
  pipe(
    ticketEquipmentId(input.rm, input.input.ticketId),
    O.match(
      () => false,
      equipmentId =>
        isEquipmentTrainer({actor: input.actor, rm: input.rm, input: {equipmentId}})
    )
  );

// Editing a ticket's title requires ownership of its equipment's area - or admin/super user.
export const isTicketOwner = (input: {
  actor: Actor;
  rm: SharedReadModel;
  input: {ticketId: UUID};
}): boolean =>
  isAdminOrSuperUser({actor: input.actor, rm: input.rm}) ||
  pipe(
    ticketEquipmentId(input.rm, input.input.ticketId),
    O.match(
      () => false,
      equipmentId =>
        isEquipmentOwner({actor: input.actor, rm: input.rm, input: {equipmentId}})
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
    ticketEquipmentId(input.rm, input.input.ticketId),
    O.match(
      () => false,
      equipmentId =>
        isEquipmentOwner({actor: input.actor, rm: input.rm, input: {equipmentId}})
    )
  );
  return ownsTarget || ownsCurrent;
};
