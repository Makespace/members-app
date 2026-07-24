import {pipe} from 'fp-ts/lib/function';
import * as TE from 'fp-ts/TaskEither';
import {constructViewModel} from './construct-view-model';
import {render} from './render';
import {Query} from '../query';
import {safe, toLoggedInContent} from '../../types/html';

export const troubleTickets: Query = deps => user =>
  pipe(
    user,
    constructViewModel(deps.sharedReadModel),
    TE.map(render),
    TE.map(toLoggedInContent(safe('Trouble Tickets')))
  );
