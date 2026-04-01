import {FailureWithStatus} from '../types/failure-with-status';
import {Actor, DomainEvent, Email} from '../types';
import {Type} from 'io-ts';
import * as E from 'fp-ts/Either';
import {Config} from '../configuration';
import {Dependencies} from '../dependencies';
import { SharedReadModel } from '../read-models/shared-state';

export type SendEmail<T> = {
  isAuthorized: (input: {
    actor: Actor;
    rm: SharedReadModel;
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
