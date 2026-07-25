import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import * as RA from 'fp-ts/ReadonlyArray';
import {
  failureWithStatus,
  FailureWithStatus,
} from '../../types/failure-with-status';
import {ViewModel, TroubleTicketView, ChangeLogEntry} from './view-model';
import {User, Actor} from '../../types';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {SharedReadModel} from '../../read-models/shared-state';
import {Dependencies} from '../../dependencies';
import {
  TroubleTicket,
  TroubleTicketStatus,
} from '../../types/trouble-ticket';
import {Member, allMemberNumbers} from '../../read-models/shared-state/return-types';
import {StoredEventOfType} from '../../types/domain-event';

// Event types that make up a ticket's change log, oldest-to-newest by event index.
const TIMELINE_TYPES = [
  'TroubleTicketAssigned',
  'TroubleTicketResolved',
  'TroubleTicketParked',
  'TroubleTicketNeedsHelp',
  'TroubleTicketEquipmentSet',
  'TroubleTicketTitleEdited',
] as const;

type TimelineEvent = StoredEventOfType<(typeof TIMELINE_TYPES)[number]>;

const actorName = (actor: Actor, rm: SharedReadModel): string => {
  switch (actor.tag) {
    case 'user':
      return pipe(
        rm.members.getByMemberNumber(actor.user.memberNumber),
        O.chain(member => member.name),
        O.getOrElse(() => `Member ${actor.user.memberNumber}`)
      );
    case 'token':
      return 'An administrator';
    case 'system':
      return 'The system';
  }
};

// Fold a ticket's events into display lines, tracking status so the first assignment reads
// "assigned themselves and set the ticket to In Progress".
const buildChangeLog = (
  events: ReadonlyArray<TimelineEvent>,
  rm: SharedReadModel
): ReadonlyArray<ChangeLogEntry> => {
  let status: TroubleTicketStatus = 'Todo';
  const entries: ChangeLogEntry[] = [];
  for (const event of events) {
    const actor = actorName(event.actor, rm);
    const at = event.recordedAt;
    switch (event.type) {
      case 'TroubleTicketAssigned': {
        const movedToInProgress =
          status === 'Todo' ||
          status === 'Needs Help' ||
          status === 'Parked';
        if (movedToInProgress) {
          status = 'In Progress';
        }
        entries.push({
          status,
          at,
          actor,
          summary: movedToInProgress
            ? 'assigned themselves and set the ticket to In Progress'
            : 'assigned themselves to this ticket',
          details: [],
        });
        break;
      }
      case 'TroubleTicketResolved':
        status = 'Resolved';
        entries.push({
          status,
          at,
          actor,
          summary: 'marked this ticket as Resolved',
          details: [{label: 'Summary', value: event.summary}],
        });
        break;
      case 'TroubleTicketParked':
        status = 'Parked';
        entries.push({
          status,
          at,
          actor,
          summary: 'parked this ticket',
          details: [
            {label: 'Why parked', value: event.whyParked},
            {label: 'Path to resolution', value: event.pathToResolution},
            {label: 'Intermediate actions', value: event.intermediateActions},
          ],
        });
        break;
      case 'TroubleTicketNeedsHelp':
        status = 'Needs Help';
        entries.push({
          status,
          at,
          actor,
          summary: 'marked this ticket as Needs Help and unassigned themselves',
          details: [
            {label: 'They tried', value: event.whatTried},
            {label: "It didn't work because", value: event.whyDidntWork},
          ],
        });
        break;
      case 'TroubleTicketEquipmentSet':
        entries.push({
          status,
          at,
          actor,
          summary: event.equipmentId
            ? 'changed the equipment for this ticket'
            : 'removed the equipment from this ticket',
          details: [],
        });
        break;
      case 'TroubleTicketTitleEdited':
        entries.push({
          status,
          at,
          actor,
          summary: `renamed this ticket to "${event.title}"`,
          details: [],
        });
        break;
    }
  }
  return entries;
};

// Fetch every timeline event once and group by ticket id (oldest first).
const fetchChangeLogs = (
  deps: Dependencies
): TE.TaskEither<FailureWithStatus, ReadonlyMap<string, ReadonlyArray<TimelineEvent>>> =>
  pipe(
    TIMELINE_TYPES,
    TE.traverseArray(type => deps.getAllEventsByType(type)),
    TE.map(RA.flatten),
    TE.map(events => {
      const sorted = [...events].sort((a, b) => a.event_index - b.event_index);
      const byTicket = new Map<string, TimelineEvent[]>();
      for (const event of sorted) {
        const existing = byTicket.get(event.ticketId) ?? [];
        existing.push(event);
        byTicket.set(event.ticketId, existing);
      }
      return byTicket;
    })
  );

const toView =
  (
    rm: SharedReadModel,
    viewer: Member,
    changeLogs: ReadonlyMap<string, ReadonlyArray<TimelineEvent>>
  ) =>
  (ticket: TroubleTicket): TroubleTicketView => {
    const equipment = ticket.equipmentId
      ? rm.equipment.get(ticket.equipmentId)
      : O.none;
    const myMemberNumbers = allMemberNumbers(viewer);
    const onMyTrainerMachine =
      ticket.equipmentId !== null &&
      viewer.trainerFor.some(t => t.equipment_id === ticket.equipmentId);
    const inMyOwnerArea = pipe(
      equipment,
      O.match(
        () => false,
        e => viewer.ownerOf.some(area => area.id === e.area.id)
      )
    );
    return {
      id: ticket.id,
      title: ticket.title,
      status: ticket.status,
      submittedAt: ticket.submittedAt,
      submittedName: ticket.submittedName,
      submittedMemberNumber: ticket.submittedMemberNumber,
      submittedEmail: ticket.submittedEmail,
      equipmentName: pipe(
        equipment,
        O.map(e => e.name)
      ),
      rawEquipment: ticket.submittedEquipment,
      response: ticket.response,
      assignees: ticket.assignedMemberNumbers.map(memberNumber => ({
        memberNumber,
        name: pipe(
          rm.members.getByMemberNumber(memberNumber),
          O.chain(member => member.name)
        ),
      })),
      assignedToMe: ticket.assignedMemberNumbers.some(n =>
        myMemberNumbers.includes(n)
      ),
      inMyOwnerArea,
      onMyTrainerMachine,
      // Mirrors isTicketTrainerOrOwner: trainer on the machine, owner of its area, or
      // super-user.
      canChangeStatus: viewer.isSuperUser || onMyTrainerMachine || inMyOwnerArea,
      changeLog: buildChangeLog(changeLogs.get(ticket.id) ?? [], rm),
    };
  };

export const constructViewModel =
  (deps: Dependencies) =>
  (user: User): TE.TaskEither<FailureWithStatus, ViewModel> => {
    const rm = deps.sharedReadModel;
    return pipe(
      rm.members.getByMemberNumber(user.memberNumber),
      TE.fromOption(
        failureWithStatus(
          'Only owners and super-users can see this page',
          StatusCodes.UNAUTHORIZED
        )
      ),
      TE.filterOrElse(
        loggedInMember =>
          loggedInMember.isSuperUser || loggedInMember.ownerOf.length > 0,
        () =>
          failureWithStatus(
            'Only owners and super-users can see this page',
            StatusCodes.FORBIDDEN
          )()
      ),
      TE.chain(loggedInMember =>
        pipe(
          fetchChangeLogs(deps),
          TE.map(changeLogs => ({
            tickets: rm.troubleTickets
              .getAll()
              .map(toView(rm, loggedInMember, changeLogs)),
          }))
        )
      )
    );
  };
