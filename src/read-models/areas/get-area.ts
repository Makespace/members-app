import {pipe} from 'fp-ts/lib/function';
import {Eq as StringEq} from 'fp-ts/string';
import * as RM from 'fp-ts/ReadonlyMap';
import * as O from 'fp-ts/Option';
import {DomainEvent, SubsetOfDomainEvent, filterByName} from '../../types';
import * as RA from 'fp-ts/ReadonlyArray';

type Area = {
  id: string;
  name: string;
  description: string;
  owners: number[];
};

const pertinentEvents = ['AreaCreated' as const, 'OwnerAdded' as const];

const updateAreas = (
  state: Map<string, Area>,
  event: SubsetOfDomainEvent<typeof pertinentEvents>
) => {
  switch (event.type) {
    case 'AreaCreated':
      state.set(event.id, {...event, owners: []});
      return state;
    case 'OwnerAdded': {
      const current = state.get(event.areaId);
      if (!current) {
        return state;
      }
      state.set(event.areaId, {
        ...current,
        owners: [...current.owners, event.memberNumber],
      });
      return state;
    }
  }
};

export const getArea =
  (events: ReadonlyArray<DomainEvent>) =>
  (areaId: string): O.Option<Area> =>
    pipe(
      events,
      filterByName(pertinentEvents),
      RA.reduce(new Map<string, Area>(), updateAreas),
      RM.lookup(StringEq)(areaId)
    );
