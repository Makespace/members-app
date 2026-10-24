import * as t from 'io-ts';
import {flow, pipe} from 'fp-ts/lib/function';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import {StatusCodes} from 'http-status-codes';
import {formatValidationErrors} from 'io-ts-reporters';
import {failureWithStatus} from '../../types/failure-with-status';
import {safe, toLoggedInContent} from '../../types/html';
import {Query} from '../query';
import {constructViewModel} from './construct-view-model';
import {render} from './render';
import {resolveEquipmentReference} from '../equipment/resolve-reference';

const invalidParams = flow(
  formatValidationErrors,
  failureWithStatus('Invalid request parameters', StatusCodes.BAD_REQUEST)
);

// Where a trainer arranges a machine's trainings: what is coming up, what has
// been, and a quick way to run any of them again.
export const equipmentTrainings: Query = deps => (user, params) =>
  pipe(
    params,
    t.strict({equipment: t.string}).decode,
    E.mapLeft(invalidParams),
    E.chain(params =>
      pipe(
        resolveEquipmentReference(deps)(params.equipment),
        E.fromOption(
          failureWithStatus('Unknown equipment', StatusCodes.NOT_FOUND)
        )
      )
    ),
    TE.fromEither,
    TE.chain(constructViewModel(deps, user, new Date())),
    TE.map(render),
    TE.map(toLoggedInContent(safe('Trainings')))
  );
