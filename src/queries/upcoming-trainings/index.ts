import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {safe, toLoggedInContent} from '../../types/html';
import {Query} from '../query';
import {constructViewModel} from './construct-view-model';
import {render} from './render';

// Where the navbar's "Get trained" goes: every training coming up, on every
// machine, so a member can find one without knowing which machine to look on.
export const upcomingTrainings: Query = deps => user =>
  pipe(
    TE.right(constructViewModel(deps, user, new Date())),
    TE.map(render),
    TE.map(toLoggedInContent(safe('Get trained')))
  );
