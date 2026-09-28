import {SharedReadModel} from '../../read-models/shared-state';
import {Member} from '../../read-models/shared-state/return-types';
import {TroubleTicket} from '../../types/trouble-ticket';

// A ticket raised from the mailbox is a member's letter to the management
// team turned into a job. It carries whatever they wrote to management, which
// is not something every area owner should be reading, so it stays with the
// team it was addressed to: the management area's owners and super-users.
//
// The rule lives here rather than in each page so that a count, a board and a
// filter cannot come to different conclusions about who may see one.
const canSeeManagementTickets = (
  member: Pick<Member, 'isSuperUser' | 'ownerOf'>,
  managementTeamAreaId: string
): boolean =>
  member.isSuperUser ||
  (managementTeamAreaId !== '' &&
    member.ownerOf.some(area => area.id === managementTeamAreaId));

// Which area a ticket belongs to: its machine's area when it names one, else
// the area it was filed against directly.
const ticketAreaId = (
  ticket: {equipmentId: string | null; areaId: string | null},
  areaOfEquipment: ReadonlyMap<string, string>
): string | null =>
  ticket.equipmentId !== null
    ? (areaOfEquipment.get(ticket.equipmentId) ?? null)
    : ticket.areaId;

const isManagementTicket = (
  ticket: {equipmentId: string | null; areaId: string | null},
  areaOfEquipment: ReadonlyMap<string, string>,
  managementTeamAreaId: string
): boolean =>
  managementTeamAreaId !== '' &&
  ticketAreaId(ticket, areaOfEquipment) === managementTeamAreaId;

// The one way to read trouble tickets for a particular person. Every page
// that lists or counts tickets goes through here, so that a page added later
// - a member-facing one especially - cannot accidentally show correspondence
// that was addressed to the management team.
export const ticketsVisibleTo = (
  rm: SharedReadModel,
  managementTeamAreaId: string,
  member: Pick<Member, 'isSuperUser' | 'ownerOf'>
): ReadonlyArray<TroubleTicket> => {
  const all = rm.troubleTickets.getAll();
  if (canSeeManagementTickets(member, managementTeamAreaId)) {
    return all;
  }
  const areaOfEquipment = new Map(
    rm.equipment
      .getAllMinimal()
      .map(item => [item.id as string, item.areaId as string])
  );
  return all.filter(
    ticket =>
      !isManagementTicket(ticket, areaOfEquipment, managementTeamAreaId)
  );
};
