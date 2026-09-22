import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import {
  failureWithStatus,
  FailureWithStatus,
} from '../../types/failure-with-status';
import {ViewModel, TroubleTicketView, ChangeLogEntry} from './view-model';
import {User, Actor} from '../../types';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {SharedReadModel} from '../../read-models/shared-state';
import {TroubleTicketChangeRow} from '../../read-models/shared-state/trouble-tickets/get';
import {Dependencies} from '../../dependencies';
import {
  TroubleTicket,
  TroubleTicketStatus,
} from '../../types/trouble-ticket';
import {Member, allMemberNumbers} from '../../read-models/shared-state/return-types';

// Cards per page. The board serves the viewer's own areas by default, but a
// super-user's "show all" can span the whole backlog - keep the DOM bounded.
export const PAGE_SIZE = 100;

const STATUS_ORDER: ReadonlyArray<TroubleTicketStatus> = [
  'Todo',
  'In Progress',
  'Needs Help',
  'Parked',
  'Resolved',
];

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

// Fold a ticket's change rows into display lines, tracking status so the
// first assignment reads "assigned themselves and set the ticket to In
// Progress". Rows come from the read-model projection, not the event store.
const buildChangeLog = (
  rows: ReadonlyArray<TroubleTicketChangeRow>,
  rm: SharedReadModel
): ReadonlyArray<ChangeLogEntry> => {
  let status: TroubleTicketStatus = 'Todo';
  const entries: ChangeLogEntry[] = [];
  for (const row of rows) {
    const actor = actorName(row.actor, rm);
    const at = row.at;
    switch (row.eventType) {
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
          details: row.details.comment
            ? [{label: 'Comment', value: row.details.comment}]
            : [],
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
          details: [{label: 'Summary', value: row.details.summary ?? ''}],
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
            {label: 'Why parked', value: row.details.whyParked ?? ''},
            {
              label: 'Path to resolution',
              value: row.details.pathToResolution ?? '',
            },
            {
              label: 'Intermediate actions',
              value: row.details.intermediateActions ?? '',
            },
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
            {label: 'They tried', value: row.details.whatTried ?? ''},
            {
              label: "It didn't work because",
              value: row.details.whyDidntWork ?? '',
            },
          ],
        });
        break;
      case 'TroubleTicketEquipmentSet':
        entries.push({
          status,
          at,
          actor,
          summary: row.details.equipmentId
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
          summary: `renamed this ticket to "${row.details.title ?? ''}"`,
          details: [],
        });
        break;
    }
  }
  return entries;
};

const toView =
  (rm: SharedReadModel, viewer: Member) =>
  (ticket: TroubleTicket): Omit<TroubleTicketView, 'changeLog'> => {
    const equipment = ticket.equipmentId
      ? rm.equipment.get(ticket.equipmentId)
      : O.none;
    const directArea = ticket.areaId ? rm.area.get(ticket.areaId) : O.none;
    const ticketArea = pipe(
      equipment,
      O.map(e => ({id: e.area.id as string, name: e.area.name})),
      O.alt(() =>
        pipe(
          directArea,
          O.map(area => ({id: area.id as string, name: area.name}))
        )
      )
    );
    const myMemberNumbers = allMemberNumbers(viewer);
    const onMyTrainerMachine =
      ticket.equipmentId !== null &&
      viewer.trainerFor.some(t => t.equipment_id === ticket.equipmentId);
    const inMyOwnerArea = pipe(
      ticketArea,
      O.match(
        () => false,
        area => viewer.ownerOf.some(owned => owned.id === area.id)
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
      areaName: pipe(
        ticketArea,
        O.map(area => area.name)
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
      // All owners are maintainers: any owner of the equipment's area may work
      // the ticket (trainers are a subset of area owners).
      canChangeStatus: viewer.isSuperUser || inMyOwnerArea,
    };
  };

// Distinct raw form strings among tickets with no resolved equipment or area,
// largest count first - each is a candidate for a name alias.
const unresolvedEquipmentNames = (
  tickets: ReadonlyArray<Omit<TroubleTicketView, 'changeLog'>>
): ReadonlyArray<{raw: string; count: number}> => {
  const counts = new Map<string, {raw: string; count: number}>();
  for (const ticket of tickets) {
    if (
      O.isSome(ticket.equipmentName) ||
      O.isSome(ticket.areaName) ||
      !ticket.rawEquipment
    ) {
      continue;
    }
    const key = ticket.rawEquipment.trim().toLowerCase();
    const existing = counts.get(key);
    if (existing) {
      existing.count++;
    } else {
      counts.set(key, {raw: ticket.rawEquipment.trim(), count: 1});
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count);
};

const statusRank = (status: TroubleTicketStatus) =>
  STATUS_ORDER.indexOf(status);

export const constructViewModel =
  (deps: Dependencies, options: {showAll: boolean; page: number}) =>
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
      TE.map(loggedInMember => {
        const all = rm.troubleTickets
          .getAll()
          .map(toView(rm, loggedInMember));
        // Default to the viewer's own areas; a viewer who owns none (e.g. a
        // super-user who isn't an owner) would see an empty page, so they get
        // everything. ?show=all is the explicit escape hatch for owners.
        const scopedToMine =
          !options.showAll && loggedInMember.ownerOf.length > 0;
        const scoped = scopedToMine
          ? all.filter(ticket => ticket.inMyOwnerArea)
          : all;
        const sorted = [...scoped].sort(
          (a, b) =>
            statusRank(a.status) - statusRank(b.status) ||
            b.submittedAt.getTime() - a.submittedAt.getTime()
        );
        const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
        const page = Math.min(Math.max(1, options.page), pageCount);
        const pageTickets = sorted.slice(
          (page - 1) * PAGE_SIZE,
          page * PAGE_SIZE
        );
        // Change logs only for the cards actually shown.
        const changeRows = rm.troubleTickets.getChangeLog(
          pageTickets.map(ticket => ticket.id)
        );
        const rowsByTicket = new Map<string, TroubleTicketChangeRow[]>();
        for (const row of changeRows) {
          const bucket = rowsByTicket.get(row.ticketId) ?? [];
          bucket.push(row);
          rowsByTicket.set(row.ticketId, bucket);
        }
        return {
          tickets: pageTickets.map(ticket => ({
            ...ticket,
            changeLog: buildChangeLog(rowsByTicket.get(ticket.id) ?? [], rm),
          })),
          scopedToMine,
          totalInScope: sorted.length,
          page,
          pageCount,
          unresolvedEquipmentNames: unresolvedEquipmentNames(all),
          canMapEquipment: loggedInMember.isSuperUser,
        };
      })
    );
  };
