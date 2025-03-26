import * as TE from 'fp-ts/TaskEither';
import {FailureWithStatus} from '../../types/failure-with-status';
import {ViewModel} from './view-model';
import {User} from '../../types';
import {UUID} from 'io-ts-types';
import {SharedReadModel} from '../../read-models/shared-state';

export const constructViewModel =
  (readModel: SharedReadModel) =>
  (user: User): TE.TaskEither<FailureWithStatus, ViewModel> => {
    
  };
