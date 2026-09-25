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
import {EquipmentCategory} from '../../types/equipment-category';
import {
  TroubleTicket,
  TroubleTicketStatus,
} from '../../types/trouble-ticket';
import {
  Member,
  MinimalEquipment,
  allMemberNumbers,
} from '../../read-models/shared-state/return-types';
import {resolveFocus} from './focus';

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
          // A quiet resolve carries no summary - show nothing rather than an
          // empty labelled line.
          details: row.details.summary
            ? [{label: 'Summary', value: row.details.summary}]
            : [],
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

// The cheap per-ticket pass: everything scoping, sorting and the
// unresolved-names panel need, resolved via two prebuilt maps rather than
// per-ticket read-model queries (rm.equipment.get expands trainers and
// trained members - far too heavy to run for every ticket on the board).
type TicketScope = {
  ticket: TroubleTicket;
  equipmentName: O.Option<string>;
  equipmentCategory: O.Option<EquipmentCategory>;
  ticketArea: O.Option<{id: string; name: string}>;
  inMyOwnerArea: boolean;
  assignedToMe: boolean;
  onMyTrainerMachine: boolean;
};

const toScope =
  (
    equipmentById: ReadonlyMap<string, MinimalEquipment>,
    areaNameById: ReadonlyMap<string, string>,
    viewer: Member
  ) =>
  (ticket: TroubleTicket): TicketScope => {
    const equipment = ticket.equipmentId
      ? equipmentById.get(ticket.equipmentId)
      : undefined;
    const areaId = equipment !== undefined ? equipment.areaId : ticket.areaId;
    const areaName =
      areaId !== null && areaId !== undefined
        ? areaNameById.get(areaId)
        : undefined;
    const ticketArea =
      areaId !== null && areaId !== undefined && areaName !== undefined
        ? O.some({id: areaId as string, name: areaName})
        : O.none;
    return {
      ticket,
      equipmentName: equipment !== undefined ? O.some(equipment.name) : O.none,
      equipmentCategory:
        equipment !== undefined ? O.some(equipment.category) : O.none,
      ticketArea,
      inMyOwnerArea: pipe(
        ticketArea,
        O.match(
          () => false,
          area => viewer.ownerOf.some(owned => owned.id === area.id)
        )
      ),
      assignedToMe: ticket.assignedMemberNumbers.some(number =>
        allMemberNumbers(viewer).includes(number)
      ),
      onMyTrainerMachine:
        ticket.equipmentId !== null &&
        viewer.trainerFor.some(t => t.equipment_id === ticket.equipmentId),
    };
  };

// The full card view, built only for tickets on the visible page.
const toView =
  (rm: SharedReadModel, viewer: Member) =>
  (scope: TicketScope): Omit<TroubleTicketView, 'changeLog'> => {
    const {
      ticket,
      equipmentName,
      equipmentCategory,
      ticketArea,
      inMyOwnerArea,
      assignedToMe,
      onMyTrainerMachine,
    } = scope;
    return {
      id: ticket.id,
      title: ticket.title,
      status: ticket.status,
      submittedAt: ticket.submittedAt,
      submittedName: ticket.submittedName,
      submittedMemberNumber: ticket.submittedMemberNumber,
      submittedEmail: ticket.submittedEmail,
      equipmentName,
      equipmentCategory,
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
      assignedToMe,
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
  scopes: ReadonlyArray<TicketScope>
): ReadonlyArray<{raw: string; count: number}> => {
  const counts = new Map<string, {raw: string; count: number}>();
  for (const scope of scopes) {
    const raw = scope.ticket.submittedEquipment;
    if (O.isSome(scope.equipmentName) || O.isSome(scope.ticketArea) || !raw) {
      continue;
    }
    const key = raw.trim().toLowerCase();
    const existing = counts.get(key);
    if (existing) {
      existing.count++;
    } else {
      counts.set(key, {raw: raw.trim(), count: 1});
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count);
};

const statusRank = (status: TroubleTicketStatus) =>
  STATUS_ORDER.indexOf(status);

// Counts describe the whole scope, not the page, so a filter chip says how
// many tickets it would show rather than how many happen to be on screen.
const countBy = <T extends string>(
  scopes: ReadonlyArray<TicketScope>,
  keys: ReadonlyArray<T>,
  test: (scope: TicketScope, key: T) => boolean
): Record<T, number> =>
  keys.reduce(
    (counts, key) => {
      counts[key] = scopes.filter(scope => test(scope, key)).length;
      return counts;
    },
    {} as Record<T, number>
  );

const SCOPE_KEYS = ['mine', 'my-area', 'my-machines'] as const;

const matchesScope = (scope: TicketScope, key: (typeof SCOPE_KEYS)[number]) => {
  switch (key) {
    case 'mine':
      return scope.assignedToMe;
    case 'my-area':
      return scope.inMyOwnerArea;
    case 'my-machines':
      return scope.onMyTrainerMachine;
  }
};

export const constructViewModel =
  (
    deps: Dependencies,
    options: {
      showAll: boolean;
      page: number;
      // Filters applied before paging, so the page is a page of the filtered
      // set rather than a filtered page.
      status: O.Option<TroubleTicketStatus>;
      only: O.Option<(typeof SCOPE_KEYS)[number]>;
      // One machine or one area, when the board was opened from it. The
      // counts and the filters then describe that thing rather than the
      // whole backlog.
      equipmentId?: string;
      areaId?: string;
    }
  ) =>
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
        const focus = resolveFocus(rm, {
          equipmentId: options.equipmentId,
          areaId: options.areaId,
        });
        // Two bulk queries replace two per-ticket queries across the whole
        // backlog; per-ticket resolution is then a map hit.
        const equipmentById = new Map(
          rm.equipment.getAllMinimal().map(e => [e.id as string, e])
        );
        const areaNameById = new Map(
          rm.area.getAllMinimal().map(area => [area.id as string, area.name])
        );
        const all = rm.troubleTickets
          .getAll()
          .map(toScope(equipmentById, areaNameById, loggedInMember));
        // Default to the viewer's own areas; a viewer who owns none (e.g. a
        // super-user who isn't an owner) would see an empty page, so they get
        // everything. ?show=all is the explicit escape hatch for owners.
        // Asking for one machine means that machine, wherever it lives: the
        // "your areas" default is about finding your way into a big backlog,
        // and somebody who arrived from a machine has already done that.
        const inFocus = pipe(
          focus,
          O.match(
            () => all,
            current =>
              all.filter(scope =>
                current.kind === 'equipment'
                  ? scope.ticket.equipmentId === current.id
                  : pipe(
                      scope.ticketArea,
                      O.match(
                        () => false,
                        area => area.id === current.id
                      )
                    )
              )
          )
        );
        const scopedToMine =
          O.isNone(focus) &&
          !options.showAll &&
          loggedInMember.ownerOf.length > 0;
        const scoped = scopedToMine
          ? inFocus.filter(scope => scope.inMyOwnerArea)
          : inFocus;
        // Counted before the filters narrow anything, so each chip reports
        // what it would show.
        const statusCounts = countBy(
          scoped,
          STATUS_ORDER,
          (scope, status) => scope.ticket.status === status
        );
        const scopeCounts = countBy(scoped, SCOPE_KEYS, matchesScope);

        const filtered = scoped
          .filter(scope =>
            pipe(
              options.status,
              O.match(
                () => true,
                status => scope.ticket.status === status
              )
            )
          )
          .filter(scope =>
            pipe(
              options.only,
              O.match(
                () => true,
                key => matchesScope(scope, key)
              )
            )
          );

        const sorted = [...filtered].sort(
          (a, b) =>
            statusRank(a.ticket.status) - statusRank(b.ticket.status) ||
            b.ticket.submittedAt.getTime() - a.ticket.submittedAt.getTime()
        );
        const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
        const page = Math.min(Math.max(1, options.page), pageCount);
        const pageScopes = sorted.slice(
          (page - 1) * PAGE_SIZE,
          page * PAGE_SIZE
        );
        // Full card views (member-name lookups) and change logs only for the
        // cards actually shown.
        const pageTickets = pageScopes.map(toView(rm, loggedInMember));
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
          focus,
          tickets: pageTickets.map(ticket => ({
            ...ticket,
            changeLog: buildChangeLog(rowsByTicket.get(ticket.id) ?? [], rm),
          })),
          scopedToMine,
          totalInScope: sorted.length,
          statusCounts,
          scopeCounts,
          activeStatus: options.status,
          activeScope: options.only,
          page,
          pageCount,
          unresolvedEquipmentNames: unresolvedEquipmentNames(all),
          canMapEquipment: loggedInMember.isSuperUser,
        };
      })
    );
  };
