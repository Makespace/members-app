import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as E from 'fp-ts/Either';
import * as TE from 'fp-ts/TaskEither';
import {flow, pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {formatValidationErrors} from 'io-ts-reporters';
import {Query} from '../query';
import {failureWithStatus} from '../../types/failure-with-status';
import {safe, toLoggedInContent} from '../../types/html';
import {constructViewModel} from './construct-view-model';
import {render} from './render';

const invalidParams = flow(
  formatValidationErrors,
  failureWithStatus('Invalid request parameters', StatusCodes.BAD_REQUEST)
);

export const memberBilling: Query = deps => (user, params) =>
  pipe(
    params,
    t.strict({member: tt.NumberFromString}).decode,
    E.mapLeft(invalidParams),
    E.map(decoded => decoded.member),
    TE.fromEither,
    TE.chain(constructViewModel(deps, user)),
    TE.map(viewModel => render(viewModel)),
    TE.map(toLoggedInContent(safe('Billing')))
  );
