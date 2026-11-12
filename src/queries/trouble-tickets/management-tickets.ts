import {SharedReadModel} from '../../read-models/shared-state';
import {ticketVisibility} from '../../trouble-tickets/permission';

export const ticketsVisibleTo = (
  rm: SharedReadModel,
  managementTeamAreaId: string,
  member: Parameters<typeof ticketVisibility>[2]
) =>
  rm.troubleTickets
    .getAll()
    .filter(ticketVisibility(rm, managementTeamAreaId, member));
