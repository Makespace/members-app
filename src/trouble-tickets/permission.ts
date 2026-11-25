import {SharedReadModel} from '../read-models/shared-state';
import {Member} from '../read-models/shared-state/return-types';
import {TroubleTicket} from '../types/trouble-ticket';

type Viewer = Pick<Member, 'isSuperUser' | 'ownerOf'>;

const ticketAreaId = (
  ticket: Pick<TroubleTicket, 'equipmentId' | 'areaId'>,
  equipmentAreas: ReadonlyMap<string, string>
): string | null =>
  ticket.equipmentId === null
    ? ticket.areaId
    : (equipmentAreas.get(ticket.equipmentId) ?? null);

// Built once per page/audience rather than resolving equipment for each row.
export const ticketVisibility = (
  rm: SharedReadModel,
  managementAreaId: string,
  viewer: Viewer
): ((ticket: TroubleTicket) => boolean) => {
  const equipmentAreas = new Map(
    rm.equipment
      .getAllMinimal()
      .map(item => [item.id as string, item.areaId as string])
  );
  const owns = (areaId: string | null) =>
    areaId !== null && viewer.ownerOf.some(area => area.id === areaId);
  const inManagement = managementAreaId !== '' && owns(managementAreaId);
  return ticket => {
    if (viewer.isSuperUser) {
      return true;
    }
    switch (ticket.permission) {
      case 'everybody':
        return true; // Callers must supply a logged-in member.
      case 'manager':
        return inManagement;
      case 'area-owner':
        return owns(ticketAreaId(ticket, equipmentAreas));
    }
  };
};

// Claim links do not override the ticket's current visibility.
export const mayUseTicketClaimLink = (
  rm: SharedReadModel,
  managementAreaId: string,
  viewer: Member,
  ticket: TroubleTicket
): boolean => ticketVisibility(rm, managementAreaId, viewer)(ticket);
