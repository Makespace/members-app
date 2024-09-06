import {DomainEvent, User} from '.';
import {FailureWithStatus} from './failure-with-status';
import * as E from 'fp-ts/Either';
import {CompleteHtmlDocument} from './html';
import {SharedReadModel} from '../read-models/shared-state';

export type Form<T> = {
  renderForm: (viewModel: T) => CompleteHtmlDocument;
  constructForm: (
    input: unknown
  ) => (context: {
    user: User;
    events: ReadonlyArray<DomainEvent>;
    readModelDb: SharedReadModel['db'];
  }) => E.Either<FailureWithStatus, T>;
};
