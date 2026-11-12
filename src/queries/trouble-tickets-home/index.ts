import {pipe} from 'fp-ts/lib/function';
import * as TE from 'fp-ts/TaskEither';
import {constructViewModel} from './construct-view-model';
import {render} from './render';
import {Query} from '../query';
import {safe, toLoggedInContent} from '../../types/html';

export const troubleTicketsHome: Query = deps => (user, _params, queryParams) =>
  pipe(
    user,
    constructViewModel(deps, {
      equipmentId:
        typeof queryParams.equipmentId === 'string'
          ? queryParams.equipmentId
          : undefined,
      areaId:
        typeof queryParams.areaId === 'string' ? queryParams.areaId : undefined,
    }),
    TE.map(render),
    TE.map(toLoggedInContent(safe('Trouble tickets')))
  );
