import {DomainEvent, User} from '.';
import {FailureWithStatus} from './failure-with-status';
import * as E from 'fp-ts/Either';
import {LoggedInContent} from './html';
import {SharedReadModel} from '../read-models/shared-state';

export type Form<T> = {
  renderForm: (viewModel: T) => LoggedInContent;
  constructForm: (
    input: unknown
  ) => (context: {
    user: User;
    events: ReadonlyArray<DomainEvent>;
    readModel: SharedReadModel;
  }) => E.Either<FailureWithStatus, T>;
};
