import {DomainEvent, User} from '.';
import {FailureWithStatus} from './failure-with-status';
import * as E from 'fp-ts/Either';
import {CompleteHtmlDocument} from './html';

export type Form<T> = {
  renderForm: (viewModel: T) => CompleteHtmlDocument;
  constructForm: (
    input: unknown
  ) => (context: {
    user: User;
    events: ReadonlyArray<DomainEvent>;
  }) => E.Either<FailureWithStatus, T>;
};
