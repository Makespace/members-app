import * as O from 'fp-ts/Option';
import {Member} from '../read-models/shared-state/return-types';

// What somebody can ask to hear about, and how often. Pure: no events and no
// storage yet, so that the shape can be looked at on a page and argued with
// before it is written into the timeline, where changing it is expensive.

// The five things that happen to a ticket, in the words a member would use
// rather than the event names.
export const TICKET_HAPPENINGS = [
  'reported',
  'picked-up',
  'needs-help',
  'parked',
  'resolved',
] as const;

type TicketHappening = (typeof TICKET_HAPPENINGS)[number];

export const happeningLabel = (happening: TicketHappening): string => {
  switch (happening) {
    case 'reported':
      return 'Reported';
    case 'picked-up':
      return 'Picked up by somebody';
    case 'needs-help':
      return 'Needs help';
    case 'parked':
      return 'Parked';
    case 'resolved':
      return 'Resolved';
  }
};

export const DELIVERIES = [
  'as-it-happens',
  'daily',
  'weekly',
  'never',
] as const;

type Delivery = (typeof DELIVERIES)[number];

export const deliveryLabel = (delivery: Delivery): string => {
  switch (delivery) {
    case 'as-it-happens':
      return 'As it happens';
    case 'daily':
      return 'Daily summary';
    case 'weekly':
      return 'Weekly summary';
    case 'never':
      return 'Never';
  }
};

export type Choice = {
  delivery: Delivery;
  happenings: ReadonlyArray<TicketHappening>;
};

// A scope either follows whatever its parent settles on, or says its own
// thing. Inheriting is the default everywhere, so that somebody who wants to
// go quiet can do it once at the top rather than machine by machine.
type Setting = {kind: 'inherit'} | {kind: 'own'; choice: Choice};

type ScopeKind =
  | 'reported-by-me'
  | 'everything'
  | 'my-areas'
  | 'area'
  | 'equipment'
  | 'everywhere-else';

export type ScopeNode = {
  // Stable across renders, and used as the form field name.
  id: string;
  kind: ScopeKind;
  label: string;
  // Why this row is in the list at all - owning the area, training in it, or
  // both. Absent on the rows that are there for everybody.
  note: O.Option<string>;
  // Named so a row can say "same as Areas I own" rather than just "inherit".
  inheritsFrom: O.Option<string>;
  setting: Setting;
  // What the rule comes to once inheritance is applied. The point of showing
  // it: a row that inherits still has an effect, and that effect is what
  // somebody is actually choosing.
  effective: Choice;
  children: ReadonlyArray<ScopeNode>;
};

const own = (
  delivery: Delivery,
  happenings: ReadonlyArray<TicketHappening>
): Setting => ({kind: 'own', choice: {delivery, happenings}});

const inherit: Setting = {kind: 'inherit'};

// Where somebody starts before they have touched anything. Chosen so that the
// people responsible for a thing hear about it and nobody else is emailed:
// owners hear when something in their area is reported or gets stuck, trainers
// hear when a machine they teach on needs help, and everything else is quiet.
const DEFAULTS: Record<string, Setting> = {
  'reported-by-me': own('as-it-happens', [
    'picked-up',
    'needs-help',
    'parked',
    'resolved',
  ]),
  everything: own('never', []),
  'my-areas': own('as-it-happens', ['reported', 'needs-help']),
  'everywhere-else': inherit,
};

const defaultFor = (id: string): Setting => DEFAULTS[id] ?? inherit;

// A child that says nothing takes its parent's answer, all the way up.
const resolve = (setting: Setting, fromParent: Choice): Choice =>
  setting.kind === 'own' ? setting.choice : fromParent;

const node = (input: {
  id: string;
  kind: ScopeKind;
  label: string;
  note?: O.Option<string>;
  inheritsFrom: O.Option<string>;
  parentChoice: Choice;
  children?: (effective: Choice) => ReadonlyArray<ScopeNode>;
}): ScopeNode => {
  const setting = defaultFor(input.id);
  const effective = resolve(setting, input.parentChoice);
  return {
    id: input.id,
    kind: input.kind,
    label: input.label,
    note: input.note ?? O.none,
    inheritsFrom: input.inheritsFrom,
    setting,
    effective,
    children: input.children === undefined ? [] : input.children(effective),
  };
};

const SILENT: Choice = {delivery: 'never', happenings: []};

// Where a machine lives, and what each area is called - enough to put a
// machine somebody trains on under the area it actually sits in.
type EquipmentPlacement = {
  id: string;
  name: string;
  areaId: string;
};

type AreaName = {id: string; name: string};

// Why an area is in somebody's list. Owning it and training in it are
// different relationships, and a row that cannot say which is harder to trust.
const roleNote = (owns: boolean, trains: boolean): O.Option<string> => {
  if (owns && trains) {
    return O.some('owner and trainer');
  }
  return owns ? O.some('owner') : trains ? O.some('trainer') : O.none;
};

// The tree a member sees: what they are responsible for first, then the rest.
// An area is listed when they own it or train on something in it - the two
// usually go together, and where they do not, somebody training in an area
// still wants to hear about it.
export const preferencesFor = (
  member: Pick<Member, 'ownerOf' | 'trainerFor'>,
  equipment: ReadonlyArray<EquipmentPlacement> = [],
  areas: ReadonlyArray<AreaName> = []
): ReadonlyArray<ScopeNode> => {
  const areaById = new Map<string, string>([
    ...areas.map(area => [area.id, area.name] as const),
    // An area somebody owns is named on their own record, so their list works
    // even when nothing else was passed in.
    ...member.ownerOf.map(area => [area.id, area.name] as const),
  ]);
  const placementById = new Map(equipment.map(item => [item.id, item]));

  const ownedAreaIds = new Set(member.ownerOf.map(area => area.id));
  // The machines they train on, grouped by the area each one sits in.
  const trainedByArea = new Map<string, EquipmentPlacement[]>();
  for (const trained of member.trainerFor) {
    const placement = placementById.get(trained.equipment_id);
    if (placement === undefined) {
      continue;
    }
    trainedByArea.set(placement.areaId, [
      ...(trainedByArea.get(placement.areaId) ?? []),
      placement,
    ]);
  }

  const myAreaIds = [
    ...new Set([...ownedAreaIds, ...trainedByArea.keys()]),
  ].sort((a, b) =>
    (areaById.get(a) ?? '').localeCompare(areaById.get(b) ?? '', ['en-GB'])
  );

  const reportedByMe = node({
    id: 'reported-by-me',
    kind: 'reported-by-me',
    label: 'Tickets I reported',
    inheritsFrom: O.none,
    parentChoice: SILENT,
  });

  const everything = node({
    id: 'everything',
    kind: 'everything',
    label: 'Everything else',
    inheritsFrom: O.none,
    parentChoice: SILENT,
    children: everythingChoice => [
      node({
        id: 'my-areas',
        kind: 'my-areas',
        label: "Areas I'm an owner or trainer in",
        inheritsFrom: O.some('Everything else'),
        parentChoice: everythingChoice,
        children: areasChoice =>
          myAreaIds.map(areaId =>
            node({
              id: `area:${areaId}`,
              kind: 'area',
              label: areaById.get(areaId) ?? 'Unnamed area',
              note: roleNote(
                ownedAreaIds.has(areaId),
                trainedByArea.has(areaId)
              ),
              inheritsFrom: O.some("Areas I'm an owner or trainer in"),
              parentChoice: areasChoice,
              children: areaChoice =>
                (trainedByArea.get(areaId) ?? []).map(machine =>
                  node({
                    id: `equipment:${machine.id}`,
                    kind: 'equipment',
                    label: machine.name,
                    note: O.some('I train on this'),
                    inheritsFrom: O.some(
                      areaById.get(areaId) ?? 'the area above'
                    ),
                    parentChoice: areaChoice,
                  })
                ),
            })
          ),
      }),
      node({
        id: 'everywhere-else',
        kind: 'everywhere-else',
        label: 'Anywhere else in Makespace',
        inheritsFrom: O.some('Everything else'),
        parentChoice: everythingChoice,
      }),
    ],
  });

  return [reportedByMe, everything];
};

// Every row in the tree, flattened - for counting, and for a form that wants
// to walk the lot without recursing.
export const allScopes = (
  nodes: ReadonlyArray<ScopeNode>
): ReadonlyArray<ScopeNode> =>
  nodes.flatMap(scope => [scope, ...allScopes(scope.children)]);

// How many rules actually send something, which is the number somebody wants
// at the top of the page.
export const soundingScopes = (
  nodes: ReadonlyArray<ScopeNode>
): ReadonlyArray<ScopeNode> =>
  allScopes(nodes).filter(
    scope =>
      scope.effective.delivery !== 'never' &&
      scope.effective.happenings.length > 0
  );
