import {pipe} from 'fp-ts/lib/function';
import * as TE from 'fp-ts/TaskEither';
import {render} from './render';
import {constructViewModel} from './construct-view-model';
import {Query} from '../query';
import {toLoggedInContent, safe, HttpResponse} from '../../types/html';

export const me: Query = deps => user =>
  pipe(
    user.memberNumber,
    constructViewModel(deps, user),
    TE.map(viewModel => render(viewModel)),
    TE.map(toLoggedInContent(safe('My Details'))),
    TE.map(HttpResponse.mk.LoggedInContent)
  );
