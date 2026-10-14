import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {Member} from '../read-models/shared-state/return-types';

// What somebody can ask to hear about, and how often. Pure: no events and no
// storage yet, so that the shape can be looked at on a page and argued with
// before it is written into the timeline, where changing it is expensive.

// The five things that happen to a ticket, in the words a member would use
// rather than the event names.
const TICKET_HAPPENINGS = [
  'reported',
  'picked-up',
  'needs-help',
  'parked',
  'resolved',
] as const;

type TicketHappening = (typeof TICKET_HAPPENINGS)[number];

// One choice, not two. How often somebody hears and how much they hear turned
// out to be the same question: anybody wanting a weekly summary wants it to
// cover everything, and anybody wanting to know the moment something breaks is
// not asking to be told about only some of it.
export const SUBSCRIPTIONS = ['live', 'daily', 'weekly', 'none'] as const;

type Subscription = (typeof SUBSCRIPTIONS)[number];

export const subscriptionLabel = (subscription: Subscription): string => {
  switch (subscription) {
    case 'live':
      return 'Live feed';
    case 'daily':
      return 'Daily summary';
    case 'weekly':
      return 'Weekly summary';
    case 'none':
      return 'No notifications';
  }
};

// What a choice comes to in the events the notifier will match on. Every
// subscription covers every change; only the frequency differs.
//
// Reporting is included for a ticket somebody reported themselves. It looked
// redundant - they know they reported it - but the email that goes out then is
// "we have logged your report", which is the most useful one they get.
export const happeningsOf = (
  subscription: Subscription
): ReadonlyArray<TicketHappening> =>
  subscription === 'none' ? [] : TICKET_HAPPENINGS;

export type Choice = Subscription;

// A scope either follows whatever its parent settles on, or says its own
// thing. Following is the default everywhere below the top three, so somebody
// who wants to go quiet can do it once rather than machine by machine.
type Setting = {kind: 'inherit'} | {kind: 'own'; choice: Choice};

type ScopeKind =
  | 'reported-by-me'
  | 'my-areas'
  | 'area'
  | 'equipment'
  | 'other-areas';

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

const own = (choice: Choice): Setting => ({kind: 'own', choice});

const inherit: Setting = {kind: 'inherit'};

// Where somebody starts before they have touched anything. The people
// responsible for a thing hear about it and nobody else is emailed: a week's
// worth of everything in the areas they look after, a day's worth for the
// machines they are named on, and silence everywhere else. A summary with
// nothing in it is not sent, so a quiet week costs nobody an email.
const DEFAULTS: Record<string, Setting> = {
  'reported-by-me': own('live'),
  'my-areas': own('weekly'),
  'other-areas': own('none'),
};

// What a member has actually said, scope by scope. Anything they have said
// nothing about falls through to the default for that scope.
const SUBSCRIPTION_VALUES: ReadonlySet<string> = new Set(SUBSCRIPTIONS);

const storedSetting = (value: string | undefined): O.Option<Setting> => {
  if (value === undefined) {
    return O.none;
  }
  if (value === 'follow') {
    return O.some(inherit);
  }
  return SUBSCRIPTION_VALUES.has(value)
    ? O.some(own(value as Choice))
    : O.none;
};

// A machine somebody is named on is their job in a way the rest of the area is
// not, so it is heard about sooner.
const defaultFor = (
  id: string,
  trainedOn: ReadonlySet<string>
): Setting => {
  const named = DEFAULTS[id];
  if (named !== undefined) {
    return named;
  }
  return id.startsWith('equipment:') &&
    trainedOn.has(id.slice('equipment:'.length))
    ? own('daily')
    : inherit;
};

// A child that says nothing takes its parent's answer, all the way up.
const resolve = (setting: Setting, fromParent: Choice): Choice =>
  setting.kind === 'own' ? setting.choice : fromParent;

const node = (input: {
  id: string;
  kind: ScopeKind;
  label: string;
  inheritsFrom: O.Option<string>;
  parentChoice: Choice;
  trainedOn: ReadonlySet<string>;
  stored: ReadonlyMap<string, string>;
  children?: (effective: Choice) => ReadonlyArray<ScopeNode>;
}): ScopeNode => {
  const setting = pipe(
    storedSetting(input.stored.get(input.id)),
    O.getOrElse(() => defaultFor(input.id, input.trainedOn))
  );
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

const SILENT: Choice = 'none';

// Where a machine lives, and what each area is called - enough to put a
// machine somebody trains on under the area it actually sits in.
type EquipmentPlacement = {
  id: string;
  name: string;
  areaId: string;
};

type AreaName = {id: string; name: string};

// The tree a member sees: what they are responsible for first, then the rest.
// An area is listed when they own it or train on something in it - the two
// usually go together, and where they do not, somebody training in an area
// still wants to hear about it.
export const preferencesFor = (
  member: Pick<Member, 'ownerOf' | 'trainerFor'>,
  equipment: ReadonlyArray<EquipmentPlacement> = [],
  areas: ReadonlyArray<AreaName> = [],
  stored: ReadonlyMap<string, string> = new Map()
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

  const myAreaIds = [...new Set([...ownedAreaIds, ...trainedByArea.keys()])];

  // Every machine in an area, so that each area reads as the list of what is
  // in it. An owner wanting to mute one noisy machine should not have to be
  // its trainer first.
  const machinesByArea = new Map<string, EquipmentPlacement[]>();
  for (const item of equipment) {
    machinesByArea.set(item.areaId, [
      ...(machinesByArea.get(item.areaId) ?? []),
      item,
    ]);
  }

  const byName = (a: string, b: string) =>
    (areaById.get(a) ?? '').localeCompare(areaById.get(b) ?? '', ['en-GB']);

  myAreaIds.sort(byName);

  const otherAreaIds = [...areaById.keys()]
    .filter(areaId => !myAreaIds.includes(areaId))
    .sort(byName);

  const trainedOn = new Set(
    member.trainerFor.map(trained => trained.equipment_id as string)
  );

  const areaNode = (
    areaId: string,
    parentLabel: string,
    parentChoice: Choice
  ): ScopeNode =>
    node({
      trainedOn,
      stored,
      id: `area:${areaId}`,
      kind: 'area',
      label: areaById.get(areaId) ?? 'Unnamed area',
      inheritsFrom: O.some(parentLabel),
      parentChoice,
      children: areaChoice =>
        (machinesByArea.get(areaId) ?? [])
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name, ['en-GB']))
          .map(machine =>
            node({
              trainedOn,
              stored,
              id: `equipment:${machine.id}`,
              kind: 'equipment',
              label: machine.name,
              inheritsFrom: O.some(areaById.get(areaId) ?? 'the area above'),
              parentChoice: areaChoice,
            })
          ),
    });

  // Three things somebody can be told about, side by side. There is no rule
  // above these: a parent whose only job was to be inherited from added a
  // level to read past without answering a question anybody had.
  const reportedByMe = node({
    trainedOn,
    stored,
    id: 'reported-by-me',
    kind: 'reported-by-me',
    label: 'Tickets I reported',
    inheritsFrom: O.none,
    parentChoice: SILENT,
  });

  const MY_AREAS_LABEL = "Areas I'm an owner or trainer in";
  const myAreas = node({
    trainedOn,
    stored,
    id: 'my-areas',
    kind: 'my-areas',
    label: MY_AREAS_LABEL,
    inheritsFrom: O.none,
    parentChoice: SILENT,
    children: areasChoice =>
      myAreaIds.map(areaId => areaNode(areaId, MY_AREAS_LABEL, areasChoice)),
  });

  const OTHER_AREAS_LABEL = 'Other areas in Makespace';
  const otherAreas = node({
    trainedOn,
    stored,
    id: 'other-areas',
    kind: 'other-areas',
    label: OTHER_AREAS_LABEL,
    inheritsFrom: O.none,
    parentChoice: SILENT,
    children: otherChoice =>
      otherAreaIds.map(areaId =>
        areaNode(areaId, OTHER_AREAS_LABEL, otherChoice)
      ),
  });

  return [reportedByMe, myAreas, otherAreas];
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
  allScopes(nodes).filter(scope => scope.effective !== 'none');
