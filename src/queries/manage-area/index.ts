import {pipe} from 'fp-ts/lib/function';
import * as TE from 'fp-ts/TaskEither';
import {Query} from '../query';
import {safe, toLoggedInContentWithBackLink} from '../../types/html';
import {constructViewModel} from './construct-view-model';
import {render} from './render';

// Everything an area's managers can change, gathered off the /areas page.
export const manageArea: Query = deps => (user, _params, queryParams) =>
  pipe(
    queryParams.area,
    constructViewModel(deps, user),
    TE.fromEither,
    TE.map(viewModel =>
      toLoggedInContentWithBackLink(safe('Manage area'), {
        href: `/areas#area-${viewModel.areaId}`,
        label: 'Areas',
      })(render(viewModel))
    )
  );
