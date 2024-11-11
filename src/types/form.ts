import {DomainEvent, User} from '.';
import {FailureWithStatus} from './failure-with-status';
import * as E from 'fp-ts/Either';
import {HttpResponse} from './html';
import {SharedReadModel} from '../read-models/shared-state';
import {Member} from './tagged-union';

export type Form<T> = {
  renderForm: (viewModel: T) => Member<HttpResponse, 'LoggedInContent'>;
  constructForm: (
    input: unknown
  ) => (context: {
    user: User;
    events: ReadonlyArray<DomainEvent>;
    readModel: SharedReadModel;
  }) => E.Either<FailureWithStatus, T>;
};
