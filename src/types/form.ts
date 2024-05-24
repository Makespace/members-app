import {DomainEvent, User} from '.';
import {FailureWithStatus} from './failureWithStatus';
import * as E from 'fp-ts/Either';

export type Form<T> = {
  renderForm: (viewModel: T) => string;
  constructForm: (
    input: unknown
  ) => (context: {
    user: User;
    events: ReadonlyArray<DomainEvent>;
  }) => E.Either<FailureWithStatus, T>;
};
