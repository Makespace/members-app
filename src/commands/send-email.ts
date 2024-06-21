import {FailureWithStatus} from '../types/failureWithStatus';
import {Actor, DomainEvent, Email} from '../types';
import {Type} from 'io-ts';
import * as E from 'fp-ts/Either';

export type SendEmail<T> = {
  isAuthorized: (input: {
    actor: Actor;
    events: ReadonlyArray<DomainEvent>;
    input: T;
  }) => boolean;
  decode: Type<T, T, unknown>['decode'];
  constructEmail: (
    events: ReadonlyArray<DomainEvent>,
    actor: Actor,
    input: T
  ) => E.Either<FailureWithStatus, Email>;
};
