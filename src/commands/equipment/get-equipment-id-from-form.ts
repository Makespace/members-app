import {pipe} from 'fp-ts/lib/function';
import * as t from 'io-ts';
import {UUID} from 'io-ts-types';
import * as E from 'fp-ts/Either';
import {formatValidationErrors} from 'io-ts-reporters';
import {failureWithStatus} from '../../types/failure-with-status';
import {StatusCodes} from 'http-status-codes';

const getEquipmentIdCodec = t.strict({
  equipmentId: UUID,
});

export const getEquipmentIdFromForm = (input: unknown) =>
  pipe(
    input,
    getEquipmentIdCodec.decode,
    E.mapLeft(formatValidationErrors),
    E.mapLeft(failureWithStatus('Invalid parameters', StatusCodes.BAD_REQUEST)),
    E.map(({equipmentId}) => equipmentId)
  );
