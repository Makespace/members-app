import {pipe} from 'fp-ts/lib/function';
import * as TE from 'fp-ts/TaskEither';
import {safe, toLoggedInContent} from '../../types/html';
import {Query} from '../query';
import {constructViewModel} from './construct-view-model';
import {render} from './render';

export const failedEventLog: Query = deps => (user, _params, query) =>
  pipe(
    query,
    constructViewModel(deps)(user),
    TE.map(render),
    TE.map(toLoggedInContent(safe('Failed Event Log')))
  );
