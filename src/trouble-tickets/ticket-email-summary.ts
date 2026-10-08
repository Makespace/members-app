import * as O from 'fp-ts/Option';
import {SharedReadModel} from '../read-models/shared-state';
import {TroubleTicket} from '../types/trouble-ticket';
import {
  TicketEmailSummary,
  ticketUrl,
} from '../templates/trouble-ticket-email';

// Turning a ticket into what the emails about it need. Kept out of the
// template so that stays a pure matter of markup, and out of the notifiers so
// the live mail and the summaries describe a ticket the same way.

type Placed = {equipmentName: string | null; areaId: string | null};

const nameOfEquipment = (
  rm: SharedReadModel,
  equipmentId: string | null
): Placed => {
  if (equipmentId === null) {
    return {equipmentName: null, areaId: null};
  }
  return O.getOrElse<Placed>(() => ({equipmentName: null, areaId: null}))(
    O.map(
      (equipment: {name: string; area: {id: string}}): Placed => ({
        equipmentName: equipment.name,
        areaId: equipment.area.id,
      })
    )(rm.equipment.get(equipmentId as Parameters<typeof rm.equipment.get>[0]))
  );
};

const nameOfArea = (rm: SharedReadModel, areaId: string | null) =>
  areaId === null
    ? null
    : O.getOrElse<string | null>(() => null)(
        O.map((area: {name: string}) => area.name)(
          rm.area.get(areaId as Parameters<typeof rm.area.get>[0])
        )
      );

export const summariseForEmail = (
  rm: SharedReadModel,
  publicUrl: string,
  ticket: TroubleTicket
): TicketEmailSummary => {
  const {equipmentName, areaId} = nameOfEquipment(rm, ticket.equipmentId);
  // The machine's area when a machine matched, else whatever area the ticket
  // was placed in directly.
  const areaName = nameOfArea(rm, areaId ?? ticket.areaId);
  return {
    title: ticket.title,
    status: ticket.status,
    equipmentName,
    areaName,
    rawEquipment: ticket.submittedEquipment,
    reportedBy: ticket.submittedName,
    reportedAt: ticket.submittedAt,
    machineStatus: ticket.response.status,
    attempting: ticket.response.attempting,
    issue: ticket.response.issue,
    steps: ticket.response.steps,
    url: ticketUrl(publicUrl, ticket.id),
  };
};
