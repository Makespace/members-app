import {Type} from 'io-ts';
import {DomainEvent} from '../types/domain-event';
import * as O from 'fp-ts/Option';
import {Actor} from '../types/actor';

export type Command<T> = {
  resource: (command: T) => {type: string; id: string};
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
