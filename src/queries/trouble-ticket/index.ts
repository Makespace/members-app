import {pipe} from 'fp-ts/lib/function';
import * as TE from 'fp-ts/TaskEither';
import {constructViewModel} from './construct-view-model';
import {render, pageTitle} from './render';
import {Query} from '../query';
import {toLoggedInContent} from '../../types/html';

export const troubleTicket: Query = deps => (user, params) =>
  pipe(
    user,
    constructViewModel(deps, typeof params.id === 'string' ? params.id : ''),
    TE.map(ticket => toLoggedInContent(pageTitle(ticket))(render(ticket)))
  );
