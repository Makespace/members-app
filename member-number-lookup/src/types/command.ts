import {Type} from 'io-ts';
import {DomainEvent} from './domain-event';
import * as O from 'fp-ts/Option';
import {User} from './user';

export type Command<T> = {
  process: (input: {
    command: T;
    events: ReadonlyArray<DomainEvent>;
  }) => O.Option<DomainEvent>;
  decode: Type<T, T, unknown>['decode'];
  isAuthorized: (input: {
    actor: User | 'admin';
    events: ReadonlyArray<DomainEvent>;
  }) => boolean;
};
