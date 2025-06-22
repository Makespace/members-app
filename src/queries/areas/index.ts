import {pipe} from 'fp-ts/lib/function';
import * as TE from 'fp-ts/TaskEither';
import {render} from './render';
import {Query} from '../query';
import {safe, toLoggedInContent} from '../../types/html';
import {constructViewModel} from './construct-view-model';

export const areas: Query = deps => user =>
  pipe(
    user,
    constructViewModel(deps.sharedReadModel),
    TE.map(render),
    TE.map(toLoggedInContent(safe('Manage Areas and Owners')))
  );
