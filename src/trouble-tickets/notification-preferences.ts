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
  | 'areas-i-own'
  | 'area'
  | 'equipment-i-train-on'
  | 'equipment'
  | 'everywhere-else';

export type ScopeNode = {
  // Stable across renders, and used as the form field name.
  id: string;
  kind: ScopeKind;
  label: string;
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
  'areas-i-own': own('as-it-happens', ['reported', 'needs-help']),
  'equipment-i-train-on': own('as-it-happens', ['needs-help']),
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
    inheritsFrom: input.inheritsFrom,
    setting,
    effective,
    children: input.children === undefined ? [] : input.children(effective),
  };
};

const SILENT: Choice = {delivery: 'never', happenings: []};

// The tree a member sees: what they are responsible for first, then the rest.
// Areas they own carry their machines; machines they train on are listed in
// their own group because teaching on something is a different relationship
// from owning the area it sits in - and the two do not always go together.
export const preferencesFor = (
  member: Pick<Member, 'ownerOf' | 'trainerFor'>
): ReadonlyArray<ScopeNode> => {
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
        id: 'areas-i-own',
        kind: 'areas-i-own',
        label: 'Areas I own',
        inheritsFrom: O.some('Everything else'),
        parentChoice: everythingChoice,
        children: areasChoice =>
          member.ownerOf.map(area =>
            node({
              id: `area:${area.id}`,
              kind: 'area',
              label: area.name,
              inheritsFrom: O.some('Areas I own'),
              parentChoice: areasChoice,
            })
          ),
      }),
      node({
        id: 'equipment-i-train-on',
        kind: 'equipment-i-train-on',
        label: 'Equipment I train on',
        inheritsFrom: O.some('Everything else'),
        parentChoice: everythingChoice,
        children: trainerChoice =>
          member.trainerFor.map(equipment =>
            node({
              id: `equipment:${equipment.equipment_id}`,
              kind: 'equipment',
              label: equipment.equipment_name,
              inheritsFrom: O.some('Equipment I train on'),
              parentChoice: trainerChoice,
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
