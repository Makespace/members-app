import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {Query} from '../query';
import {sanitizeString, toLoggedInContentWithBackLink} from '../../types/html';
import {constructViewModel} from './construct-view-model';
import {render} from './render';

// One purchasing area: its budget this year, areas, purchasers and requests.
export const purchasingArea: Query = deps => (user, params) =>
  pipe(
    params.id,
    constructViewModel(deps.sharedReadModel, user, new Date()),
    TE.fromEither,
    TE.map(viewModel =>
      toLoggedInContentWithBackLink(
        sanitizeString(viewModel.purchasingArea.name),
        {href: '/purchasing-areas', label: 'Purchasing areas'}
      )(render(viewModel))
    )
  );
