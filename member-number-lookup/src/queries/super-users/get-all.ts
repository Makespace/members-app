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

export const getAll =
  () =>
  (
    events: ReadonlyArray<DomainEvent>
  ): ReadonlyArray<{memberNumber: number; since: Date}> =>
    pipe(
      events,
      filterByName(['SuperUserRevoked', 'SuperUserDeclared']),
      RA.reduce(new Map(), updateSuperUsers),
      superUsers => Array.from(superUsers.values())
    );
