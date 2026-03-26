import {Type} from 'io-ts';
import {DomainEvent} from '../types/domain-event';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {Actor} from '../types/actor';
import {Resource} from '../types/resource';
import { FailureWithStatus } from '../types/failure-with-status';
import { Dependencies } from '../dependencies';

export type WithActor<T> = T & {actor: Actor};

export type Command<T> = {
  resource: (command: T) => Resource;
  process: (input: {
    command: WithActor<T>;
    events: ReadonlyArray<DomainEvent>;
    deps: Dependencies;
  }) => TE.TaskEither<FailureWithStatus, O.Option<DomainEvent>>;
  decode: Type<T, T, unknown>['decode'];
  isAuthorized: (input: {
    actor: Actor;
    events: ReadonlyArray<DomainEvent>;
    input: T;
  }) => boolean;
};
