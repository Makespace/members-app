/* eslint-disable unused-imports/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
import * as O from 'fp-ts/Option';
import * as RA from 'fp-ts/ReadonlyArray';
import {
  DomainEvent,
  EmailAddress,
  SubsetOfDomainEvent,
  filterByName,
} from '../../types';
import {pipe} from 'fp-ts/lib/function';
import {EventName, isEventOfType} from '../../types/domain-event';

type Member = {
  number: number;
  email: EmailAddress;
  name: O.Option<string>;
  pronouns: O.Option<string>;
};

type PotentialOwner = Member & {
  agreementSigned: O.Option<Date>;
};

type AreaOwners = {
  existing: ReadonlyArray<Member>;
  potential: ReadonlyArray<PotentialOwner>;
};

const pertinentEventTypes: Array<EventName> = [
  'MemberNumberLinkedToEmail',
  'MemberDetailsUpdated',
];

const handleEvent = (
  state: Map<Member['number'], Member>,
  event: SubsetOfDomainEvent<typeof pertinentEventTypes>
) => {
  if (isEventOfType('MemberNumberLinkedToEmail')(event)) {
    state.set(event.memberNumber, {
      number: event.memberNumber,
      email: event.email,
      name: O.none,
      pronouns: O.none,
    });
  }
  if (isEventOfType('MemberDetailsUpdated')(event)) {
    const current = state.get(event.memberNumber);
    const name = O.fromNullable(event.name);
    const pronouns = O.fromNullable(event.pronouns);
    if (current) {
      state.set(event.memberNumber, {...current, name, pronouns});
    }
  }
  return state;
};

export const getPotentialOwners =
  (areaId: string) =>
  (events: ReadonlyArray<DomainEvent>): O.Option<AreaOwners> =>
    pipe(
      events,
      filterByName(pertinentEventTypes),
      RA.reduce(new Map(), handleEvent),
      existing => ({
        existing: Array.from(existing.values()),
        potential: [],
      }),
      O.some
    );
