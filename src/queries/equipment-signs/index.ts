import {pipe} from 'fp-ts/lib/function';
import * as TE from 'fp-ts/TaskEither';
import {constructViewModel} from './construct-view-model';
import {render, renderPrintDocument} from './render';
import {Query} from '../query';
import {HttpResponse} from '../../types';
import {safe, toLoggedInContent} from '../../types/html';

export const equipmentSigns: Query = deps => (user, _params, queryParams) =>
  pipe(
    user,
    constructViewModel(deps, {
      areaId:
        typeof queryParams.areaId === 'string' ? queryParams.areaId : undefined,
      equipmentId:
        typeof queryParams.equipmentId === 'string'
          ? queryParams.equipmentId
          : undefined,
      size: typeof queryParams.size === 'string' ? queryParams.size : undefined,
    }),
    // Asked to print: hand back a document that is only the signs, so what
    // is on screen and what comes out of the printer are the same thing.
    TE.map(viewModel =>
      queryParams.print === '1'
        ? HttpResponse.Raw({
            body: renderPrintDocument(viewModel),
            contentType: 'text/html; charset=utf-8',
          })
        : toLoggedInContent(safe('Equipment signs'))(render(viewModel))
    )
  );
