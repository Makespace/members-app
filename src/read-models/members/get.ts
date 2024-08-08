import {pipe} from 'fp-ts/lib/function';
import * as O from 'fp-ts/Option';
import {DomainEvent, Actor, User} from '../../types';
import {getAllDetailsAsActor} from './get-all';

export const getDetailsAsActor =
  (actorOrUser: Actor | User) =>
  (memberNumber: number) =>
  (events: ReadonlyArray<DomainEvent>) =>
    pipe(events, getAllDetailsAsActor(actorOrUser), allDetails =>
      O.fromNullable(allDetails.get(memberNumber))
    );
