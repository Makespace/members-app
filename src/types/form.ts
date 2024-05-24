import {User} from '.';
import {FailureWithStatus} from './failureWithStatus';
import * as E from 'fp-ts/Either';

export type Form<T> = {
  renderForm: (viewModel: T) => string;
  constructForm: (
    input: unknown
  ) => (user: User) => E.Either<FailureWithStatus, T>;
};
