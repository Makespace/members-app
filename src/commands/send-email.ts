import {FailureWithStatus} from '../types/failureWithStatus';
import {Actor, DomainEvent, Email} from '../types';
import {Type} from 'io-ts';
import * as E from 'fp-ts/Either';
import {Config} from '../configuration';

export type SendEmail<T> = {
  isAuthorized: (input: {
    actor: Actor;
    events: ReadonlyArray<DomainEvent>;
    input: T;
  }) => boolean;
  decode: Type<T, T, unknown>['decode'];
  constructEmail: (
    conf: Config,
    events: ReadonlyArray<DomainEvent>,
    actor: Actor,
    input: T
  ) => E.Either<FailureWithStatus, Email>;
};
