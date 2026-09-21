import * as tt from 'io-ts-types';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {flow, pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {formatValidationErrors} from 'io-ts-reporters';
import {render} from './render';
import {Query, Params} from '../query';
import {safe, toLoggedInContent} from '../../types/html';
import {failureWithStatus} from '../../types/failure-with-status';
import {constructViewModel} from './construct-view-model';

const invalidParams = flow(
  formatValidationErrors,
  failureWithStatus('Invalid request parameters', StatusCodes.BAD_REQUEST)
);

// /event-log-order          -> no event selected (params.index absent)
// /event-log-order/:index   -> select that event_index
const parseSelectedIndex = (params: Params) =>
  params.index === undefined
    ? E.right(O.none)
    : pipe(
        tt.NumberFromString.decode(params.index),
        E.bimap(invalidParams, O.some)
      );

export const eventLogOrder: Query = deps => (user, params, queryParams) =>
  pipe(
    parseSelectedIndex(params),
    TE.fromEither,
    TE.chain(selectedIndex =>
      constructViewModel(
        deps,
        selectedIndex,
        queryParams.truncate === '1',
        // Highlight is an event-type prefix; constrain it to type-name
        // characters so arbitrary input never reaches the page.
        typeof queryParams.highlight === 'string' &&
          /^[A-Za-z]{1,64}$/.test(queryParams.highlight)
          ? queryParams.highlight
          : null
      )(user)
    ),
    TE.map(render),
    TE.map(toLoggedInContent(safe('Event log order')))
  );
