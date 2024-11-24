import {pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import {failureWithStatus} from '../../types/failure-with-status';
import {StatusCodes} from 'http-status-codes';
import {SharedReadModel} from '../../read-models/shared-state';
import {UUID} from 'io-ts-types';

export const getEquipmentName = (
  readModel: SharedReadModel,
  equipmentId: UUID
) =>
  pipe(
    equipmentId,
    readModel.equipment.get,
    E.fromOption(() =>
      failureWithStatus('No such equipment', StatusCodes.NOT_FOUND)()
    ),
    E.map(equipment => equipment.name)
  );
