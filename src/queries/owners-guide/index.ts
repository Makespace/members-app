import {pipe} from 'fp-ts/lib/function';
import * as TE from 'fp-ts/TaskEither';
import {Query} from '../query';
import {toLoggedInContentWithBackLink, safe} from '../../types/html';
import {constructViewModel} from './construct-view-model';
import {render} from './render';

export const ownersGuide: Query = deps => user =>
  pipe(
    render(constructViewModel(deps.sharedReadModel, user)),
    toLoggedInContentWithBackLink(safe("Owner's guide"), {
      href: '/admin',
      label: 'Owner',
    }),
    TE.right
  );
