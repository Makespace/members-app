import * as t from 'io-ts';
import {flow, pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import * as TE from 'fp-ts/TaskEither';
import {render} from './render';
import {constructViewModel} from './construct-view-model';
import {Query} from '../query';
import {failureWithStatus} from '../../types/failure-with-status';
import {StatusCodes} from 'http-status-codes';
import {formatValidationErrors} from 'io-ts-reporters';
import * as tt from 'io-ts-types';
import {safe, toLoggedInContent} from '../../types/html';

const invalidParams = flow(
  formatValidationErrors,
  failureWithStatus('Invalid request parameters', StatusCodes.BAD_REQUEST)
);

export const member: Query = deps => (user, params) =>
  pipe(
    params,
    t.strict({member: tt.NumberFromString}).decode,
    E.mapLeft(invalidParams),
    E.map(params => params.member),
    TE.fromEither,
    TE.map(constructViewModel(deps, user)),
    TE.flatten,
    TE.map(viewModel => render(viewModel)),
    TE.map(toLoggedInContent(safe('Member'))),
  );
