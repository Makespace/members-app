import {flow, pipe} from 'fp-ts/lib/function';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {UUID} from 'io-ts-types';
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

// ?equipment=<uuid> is optional: absent -> the machine picker.
const parseSelectedEquipment = (queryParams: Params) =>
  queryParams.equipment === undefined
    ? E.right(O.none)
    : pipe(UUID.decode(queryParams.equipment), E.bimap(invalidParams, O.some));

export const trainingEventLog: Query = deps => (user, _params, queryParams) =>
  pipe(
    parseSelectedEquipment(queryParams),
    TE.fromEither,
    TE.chain(selected =>
      constructViewModel(deps.sharedReadModel, deps.extDB, selected)(user)
    ),
    TE.map(render),
    TE.map(toLoggedInContent(safe('Training event log')))
  );
