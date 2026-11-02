import {pipe} from 'fp-ts/lib/function';
import {Query} from '../query';
import {toLoggedInContent, safe} from '../../types/html';
import {failureWithStatus} from '../../types/failure-with-status';
import {StatusCodes} from 'http-status-codes';
import * as TE from 'fp-ts/TaskEither';
import {render} from './render';
import {constructViewModel} from './construct-view-model';

// The navbar's Owner (or Admin) page: owners see their areas, super-users
// the admin links, and anybody who is neither has nothing here.
export const admin: Query = deps => user =>
  pipe(
    constructViewModel(deps, user),
    TE.filterOrElse(
      viewModel => viewModel.isSuperUser || viewModel.ownedAreas.length > 0,
      () =>
        failureWithStatus(
          'You are not authorised to see this page',
          StatusCodes.FORBIDDEN
        )()
    ),
    TE.map(viewModel =>
      pipe(
        render(viewModel),
        toLoggedInContent(
          safe(viewModel.ownedAreas.length > 0 ? 'Owner' : 'Admin')
        )
      )
    )
  );
