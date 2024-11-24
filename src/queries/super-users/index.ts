import {pipe} from 'fp-ts/lib/function';
import * as TE from 'fp-ts/TaskEither';
import {render} from './render';
import {constructViewModel} from './construct-view-model';
import {Query} from '../query';
import {safe, toLoggedInContent} from '../../types/html';

export const superUsers: Query = deps => user =>
  pipe(
    user,
    constructViewModel(deps),
    TE.map(render),
    TE.map(toLoggedInContent(safe('Super Users')))
  );
