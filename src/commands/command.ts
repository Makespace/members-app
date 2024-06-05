import {Type} from 'io-ts';
import {DomainEvent} from '../types/domain-event';
import * as O from 'fp-ts/Option';
import {Actor} from '../types/actor';
import {Resource} from '../types/resource';

type WithActor<T> = T & {actor: Actor};

export type Command<T> = {
  resource: (command: T) => Resource;
  process: (input: {
    command: WithActor<T>;
    events: ReadonlyArray<DomainEvent>;
  }) => O.Option<DomainEvent>;
  decode: Type<T, T, unknown>['decode'];
  isAuthorized: (input: {
    actor: Actor;
    events: ReadonlyArray<DomainEvent>;
  }) => boolean;
};
