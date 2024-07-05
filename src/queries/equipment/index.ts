import * as t from 'io-ts';
import {flow, pipe} from 'fp-ts/lib/function';
import * as TE from 'fp-ts/TaskEither';
import {failureWithStatus} from '../../types/failure-with-status';
import {StatusCodes} from 'http-status-codes';
import {constructViewModel} from './construct-view-model';
import {render} from './render';
import * as E from 'fp-ts/Either';
import {formatValidationErrors} from 'io-ts-reporters';
import {Query} from '../query';
import {HttpResponse} from '../../types';

const invalidParams = flow(
  formatValidationErrors,
  failureWithStatus('Invalid request parameters', StatusCodes.BAD_REQUEST)
);

export const equipment: Query = deps => (user, params) =>
  pipe(
    params,
    t.strict({equipment: t.string}).decode,
    E.mapLeft(invalidParams),
    E.map(params => params.equipment),
    TE.fromEither,
    TE.chain(constructViewModel(deps, user)),
    TE.map(viewModel =>
      HttpResponse.mk.Page({
        html: render(viewModel),
      })
    )
  );
