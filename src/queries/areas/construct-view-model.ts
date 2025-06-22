import {pipe} from 'fp-ts/lib/function';
import {User} from '../../types';
import {Dependencies} from '../../dependencies';
import * as TE from 'fp-ts/TaskEither';
import {FailureWithStatus} from '../../types/failure-with-status';
import {ViewModel} from './view-model';

import {mustBeSuperuser} from '../util';

export const constructViewModel =
  (sharedReadModel: Dependencies['sharedReadModel']) =>
  (user: User): TE.TaskEither<FailureWithStatus, ViewModel> =>
    pipe(
      mustBeSuperuser(sharedReadModel, user),
      TE.map(() => ({
        areas: sharedReadModel.area.getAll(),
      }))
    );
