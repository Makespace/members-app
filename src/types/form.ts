import {User} from '.';
import {FailureWithStatus} from './failure-with-status';
import * as TE from 'fp-ts/TaskEither';
import {HttpResponse} from './html';
import {SharedReadModel} from '../read-models/shared-state';
import {Member} from './tagged-union';
import { Dependencies } from '../dependencies';

export type FormDependencies = Pick<Dependencies, 'getEventById'>;

export type Form<T> = {
  renderForm: (viewModel: T) => Member<HttpResponse, 'LoggedInContent'>;
  constructForm: (input: unknown) => (context: {
    user: User;
    readModel: SharedReadModel;
    deps: FormDependencies,
  }) => TE.TaskEither<FailureWithStatus, T>;
};
