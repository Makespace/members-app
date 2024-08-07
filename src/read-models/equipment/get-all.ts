import {pipe} from 'fp-ts/lib/function';
import * as O from 'fp-ts/Option';
import {DomainEvent, isEventOfType} from '../../types';
import * as RA from 'fp-ts/ReadonlyArray';
import {readModels} from '..';
import {UUID} from 'io-ts-types';

type Equipment = {
  name: string;
  id: UUID;
  areaId: UUID;
  areaName: string;
  trainingSheetId: O.Option<string>;
};

export const getAll = (
  events: ReadonlyArray<DomainEvent>
): ReadonlyArray<Equipment> =>
  pipe(
    events,
    RA.filter(isEventOfType('EquipmentAdded')),
    RA.map(equipment =>
      pipe(
        readModels.areas.getArea(events)(equipment.areaId),
        O.map(area => ({
          ...equipment,
          areaName: area.name,
        })),
        O.map(equipmentData => ({
          ...equipmentData,
          trainingSheetId: readModels.equipment.getTrainingSheetId(events)(
            equipmentData.id
          ),
        }))
      )
    ),
    RA.compact
  );
