import {pipe} from 'fp-ts/lib/function';
import * as O from 'fp-ts/Option';
import {DomainEvent} from '../../types';
import {replayState} from './shared-state';
import {Member} from './member';
import * as RM from 'fp-ts/ReadonlyMap';
import {Eq as NumberEq} from 'fp-ts/number';

export const getDetails =
  (memberNumber: number) =>
  (events: ReadonlyArray<DomainEvent>): O.Option<Member> =>
    pipe(
      events,
      replayState,
      state => state.members,
      RM.lookup(NumberEq)(memberNumber)
    );
