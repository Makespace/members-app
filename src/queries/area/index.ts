import * as t from 'io-ts';
import {flow, pipe} from 'fp-ts/lib/function';
import * as TE from 'fp-ts/TaskEither';
import {failureWithStatus} from '../../types/failureWithStatus';
import {StatusCodes} from 'http-status-codes';
import {constructViewModel} from './construct-view-model';
import {render} from './render';
import * as E from 'fp-ts/Either';
import {formatValidationErrors} from 'io-ts-reporters';
import {Query} from '../query';

const invalidParams = flow(
  formatValidationErrors,
  failureWithStatus('Invalid request parameters', StatusCodes.BAD_REQUEST)
);

export const area: Query = deps => (user, params) =>
  pipe(
    params,
    t.strict({area: t.string}).decode,
    E.mapLeft(invalidParams),
    E.map(params => params.area),
    TE.fromEither,
    TE.chain(areaId => constructViewModel(deps)(areaId, user)),
    TE.map(viewModel => ({
      title: viewModel.area.name,
      body: render(viewModel),
    }))
  );
