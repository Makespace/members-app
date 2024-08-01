import {pipe} from 'fp-ts/lib/function';
import * as O from 'fp-ts/Option';
import {DomainEvent, Actor, User} from '../../types';
import {getAllDetailsAsActor} from './get-all';
import {replayState} from './shared-state';
import * as RM from 'fp-ts/ReadonlyMap';
import {Eq as NumberEq} from 'fp-ts/number';
import {Member} from './member';

export const getDetails =
  (memberNumber: number) =>
  (events: ReadonlyArray<DomainEvent>): O.Option<Member> =>
    pipe(
      events,
      replayState,
      state => state.members,
      RM.lookup(NumberEq)(memberNumber)
    );

export const getDetailsAsActor =
  (actorOrUser: Actor | User) =>
  (memberNumber: number) =>
  (events: ReadonlyArray<DomainEvent>) =>
    pipe(events, getAllDetailsAsActor(actorOrUser), allDetails =>
      O.fromNullable(allDetails.get(memberNumber))
    );
