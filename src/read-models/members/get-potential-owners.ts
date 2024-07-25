import * as O from 'fp-ts/Option';
import * as RA from 'fp-ts/ReadonlyArray';
import {DomainEvent} from '../../types';
import {pipe} from 'fp-ts/lib/function';
import {replayState} from './shared-state';
import {Member} from './member';

export type AreaOwners = {
  existing: ReadonlyArray<Member>;
  potential: ReadonlyArray<Member>;
};

export const getPotentialOwners =
  (areaId: string) =>
  (events: ReadonlyArray<DomainEvent>): O.Option<AreaOwners> =>
    pipe(
      events,
      replayState,
      O.some,
      O.bind('requestedArea', ({areas}) => O.fromNullable(areas.get(areaId))),
      O.bind('existing', ({members, requestedArea}) =>
        pipe(
          requestedArea.owners,
          owners => Array.from(owners.values()),
          O.traverseArray(memberNumber =>
            O.fromNullable(members.get(memberNumber))
          )
        )
      ),
      O.bind('potential', ({requestedArea, members}) =>
        pipe(
          Array.from(members.values()),
          RA.filter(
            ({memberNumber: number}) => !requestedArea.owners.has(number)
          ),
          O.some
        )
      )
    );
