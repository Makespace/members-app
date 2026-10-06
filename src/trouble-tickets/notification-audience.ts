import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {EmailAddressCodec} from '../types/email-address';
import {SharedReadModel} from '../read-models/shared-state';
import {Member} from '../read-models/shared-state/return-types';
import {TroubleTicket} from '../types/trouble-ticket';
import {
  allScopes,
  Choice,
  happeningsOf,
  preferencesFor,
  ScopeNode,
} from './notification-preferences';

// Who hears about a change to a ticket, and how soon. The page decides what
// somebody wants; this works out what that means for one ticket in front of
// us.

// The five events the notifier handles, as the happenings a rule talks about.
type TicketHappeningName =
  | 'reported'
  | 'picked-up'
  | 'needs-help'
  | 'parked'
  | 'resolved';

export const happeningOfEvent = (
  eventType: string
): O.Option<TicketHappeningName> => {
  switch (eventType) {
    case 'TroubleTicketCreated':
      return O.some('reported');
    case 'TroubleTicketAssigned':
      return O.some('picked-up');
    case 'TroubleTicketNeedsHelp':
      return O.some('needs-help');
    case 'TroubleTicketParked':
      return O.some('parked');
    case 'TroubleTicketResolved':
      return O.some('resolved');
    default:
      return O.none;
  }
};

// Sooner wins. Somebody who reported a ticket in an area they get a weekly
// summary of should still hear about their own ticket when they asked to -
// the two rules both apply, and the more immediate of them is the answer.
const SOONEST: ReadonlyArray<Choice> = ['live', 'daily', 'weekly', 'none'];

const soonest = (a: Choice, b: Choice): Choice =>
  SOONEST.indexOf(a) <= SOONEST.indexOf(b) ? a : b;

const findScope = (
  scopes: ReadonlyArray<ScopeNode>,
  id: string
): O.Option<ScopeNode> =>
  O.fromNullable(allScopes(scopes).find(scope => scope.id === id));

// What one member's rules come to for one ticket. The most specific rule that
// covers it wins, and a rule about a ticket they reported is weighed alongside
// it rather than instead of it.
export const subscriptionForTicket = (
  scopes: ReadonlyArray<ScopeNode>,
  memberNumber: number,
  ticket: Pick<
    TroubleTicket,
    'equipmentId' | 'areaId' | 'submittedMemberNumber'
  >,
  areaOfEquipment: ReadonlyMap<string, string>
): Choice => {
  const byPlace = (): Choice => {
    if (ticket.equipmentId !== null) {
      const machine = findScope(scopes, `equipment:${ticket.equipmentId}`);
      if (O.isSome(machine)) {
        return machine.value.effective;
      }
    }
    const areaId =
      ticket.equipmentId !== null
        ? (areaOfEquipment.get(ticket.equipmentId) ?? null)
        : ticket.areaId;
    if (areaId !== null) {
      const area = findScope(scopes, `area:${areaId}`);
      if (O.isSome(area)) {
        return area.value.effective;
      }
    }
    // A ticket that resolved to nothing belongs to no area, so it falls to
    // whatever somebody said about the rest of Makespace.
    return O.getOrElse<Choice>(() => 'none')(
      O.map((scope: ScopeNode) => scope.effective)(
        findScope(scopes, 'other-areas')
      )
    );
  };

  const mine =
    ticket.submittedMemberNumber === memberNumber
      ? O.getOrElse<Choice>(() => 'none')(
          O.map((scope: ScopeNode) => scope.effective)(
            findScope(scopes, 'reported-by-me')
          )
        )
      : 'none';

  return soonest(byPlace(), mine);
};

// Everybody who could plausibly want to hear about a ticket: the people it
// already concerns, and anybody who has said anything at all about their
// notifications. The second set is what lets somebody follow an area they have
// nothing to do with, and it stays small because most members never open the
// page.
const candidates = (
  rm: SharedReadModel,
  ticket: Pick<
    TroubleTicket,
    'equipmentId' | 'areaId' | 'submittedMemberNumber'
  >
): ReadonlyArray<Member> => {
  const numbers = new Set<number>(rm.notificationPreferences.membersWithAny());

  if (ticket.submittedMemberNumber !== null) {
    numbers.add(ticket.submittedMemberNumber);
  }

  const areaId =
    ticket.equipmentId !== null
      ? O.getOrElseW(() => null)(
          O.map((equipment: {area: {id: string}}) => equipment.area.id)(
            rm.equipment.get(ticket.equipmentId)
          )
        )
      : ticket.areaId;

  if (areaId !== null) {
    O.map((area: {owners: ReadonlyArray<{memberNumber: number}>}) =>
      area.owners.forEach(owner => numbers.add(owner.memberNumber))
    )(rm.area.get(areaId as Parameters<typeof rm.area.get>[0]));
  }

  if (ticket.equipmentId !== null) {
    O.map((equipment: {trainers: ReadonlyArray<{memberNumber: number}>}) =>
      equipment.trainers.forEach(trainer => numbers.add(trainer.memberNumber))
    )(rm.equipment.get(ticket.equipmentId));
  }

  return [...numbers]
    .map(memberNumber => rm.members.getByMemberNumber(memberNumber))
    .filter(O.isSome)
    .map(member => member.value);
};

type Audience = {
  memberNumber: number;
  email: Member['primaryEmailAddress'];
  when: Choice;
};

// Who should be told about this change, and how soon each of them asked to
// hear it. The notifier sends the live ones now and leaves the rest to the
// summaries.
export const audienceFor = (
  rm: SharedReadModel,
  ticket: TroubleTicket,
  happening: TicketHappeningName
): ReadonlyArray<Audience> => {
  const equipment = rm.equipment.getAllMinimal().map(item => ({
    id: item.id as string,
    name: item.name,
    areaId: item.areaId as string,
  }));
  const areas = rm.area
    .getAllMinimal()
    .map(area => ({id: area.id as string, name: area.name}));
  const areaOfEquipment = new Map(
    equipment.map(item => [item.id, item.areaId])
  );

  // Somebody who reported a problem but is not a member we can match - a
  // form filled in with an address we do not hold - still hears that it was
  // logged. They have no account to keep a preference on, and it is only ever
  // about their own ticket.
  const unmatchedReporter: ReadonlyArray<Audience> =
    ticket.submittedMemberNumber === null && ticket.submittedEmail !== null
      ? pipe(
          EmailAddressCodec.decode(ticket.submittedEmail),
          E.match(
            () => [],
            (email): ReadonlyArray<Audience> => [
              {memberNumber: -1, email, when: 'live'},
            ]
          )
        )
      : [];

  return [
    ...unmatchedReporter,
    ...candidates(rm, ticket)
    .map(member => {
      const scopes = preferencesFor(
        member,
        equipment,
        areas,
        rm.notificationPreferences.forMember(member.memberNumber)
      );
      const when = subscriptionForTicket(
        scopes,
        member.memberNumber,
        ticket,
        areaOfEquipment
      );
      return {
        memberNumber: member.memberNumber,
        email: member.primaryEmailAddress,
        when,
      };
    })
      .filter(
        entry =>
          entry.when !== 'none' && happeningsOf(entry.when).includes(happening)
      ),
  ];
};
