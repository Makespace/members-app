import {FailureWithStatus} from '../types/failure-with-status';
import {Actor, DomainEvent, Email} from '../types';
import {Type} from 'io-ts';
import * as E from 'fp-ts/Either';
import {Config} from '../configuration';
import {Dependencies} from '../dependencies';

export type SendEmail<T> = {
  isAuthorized: (input: {
    actor: Actor;
    events: ReadonlyArray<DomainEvent>;
    input: T;
  }) => boolean;
  decode: Type<T, T, unknown>['decode'];
  constructEmail: (
    conf: Config,
    deps: Dependencies,
    actor: Actor,
    input: T
  ) => E.Either<FailureWithStatus, Email>;
};
