import {pipe} from 'fp-ts/lib/function';
import * as TE from 'fp-ts/TaskEither';
import {render} from './render';
import {constructViewModel} from './construct-view-model';
import {Query, Params} from '../query';
import {safe, toLoggedInContent} from '../../types/html';
import {User} from '../../types';

export const deletedEvents: Query =
  deps => (user: User, _params: Params, query: Params) =>
    pipe(
      query,
      constructViewModel(deps)(user),
      TE.map(render),
      TE.map(toLoggedInContent(safe('Deleted Events')))
    );
