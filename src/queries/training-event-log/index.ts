import {pipe} from 'fp-ts/lib/function';
import * as TE from 'fp-ts/TaskEither';
import {render} from './render';
import {Query} from '../query';
import {safe, toLoggedInContent} from '../../types/html';
import {constructViewModel} from './construct-view-model';

export const trainingEventLog: Query = deps => user =>
  pipe(
    user,
    constructViewModel(deps.sharedReadModel, deps.extDB),
    TE.map(render),
    TE.map(toLoggedInContent(safe('Training event log')))
  );
