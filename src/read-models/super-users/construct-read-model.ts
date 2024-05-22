import {pipe} from 'fp-ts/lib/function';
import {DomainEvent, SubsetOfDomainEvent, filterByName} from '../../types';
import * as RA from 'fp-ts/ReadonlyArray';

type SuperUsers = Map<number, {memberNumber: number; since: Date}>;

const updateSuperUsers = (
  state: SuperUsers,
  event: SubsetOfDomainEvent<['SuperUserDeclared', 'SuperUserRevoked']>
): SuperUsers => {
  switch (event.type) {
    case 'SuperUserDeclared':
      state.set(event.memberNumber, {
        memberNumber: event.memberNumber,
        since: event.declaredAt,
      });
      break;
    case 'SuperUserRevoked':
      state.delete(event.memberNumber);
  }
  return state;
};

export const constructReadModel = (
  events: ReadonlyArray<DomainEvent>
): SuperUsers =>
  pipe(
    events,
    filterByName(['SuperUserRevoked', 'SuperUserDeclared']),
    RA.reduce(new Map(), updateSuperUsers)
  );
