import {Type} from 'io-ts';
import {DomainEvent} from './domain-event';
import * as O from 'fp-ts/Option';
import {Actor} from './actor';

export type Command<T> = {
  process: (input: {
    command: T;
    events: ReadonlyArray<DomainEvent>;
  }) => O.Option<DomainEvent>;
  decode: Type<T, T, unknown>['decode'];
  isAuthorized: (input: {
    actor: Actor;
    events: ReadonlyArray<DomainEvent>;
  }) => boolean;
};
