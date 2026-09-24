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

// What the QR code on a red sign leads to: the two steps to being trained on
// this machine, and how far the member reading it has got.
export const equipmentTraining: Query = deps => (user, params) =>
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
    TE.chain(constructViewModel(deps, user)),
    TE.map(render),
    TE.map(toLoggedInContent(safe('Get trained')))
  );
