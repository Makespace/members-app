import {pipe} from 'fp-ts/lib/function';
import {DomainEvent, isEventOfType} from '../../types';
import * as RA from 'fp-ts/ReadonlyArray';
import {UUID} from 'io-ts-types';

type Equipment = {
  name: string;
  id: UUID;
  areaId: UUID;
};

export const getForArea =
  (events: ReadonlyArray<DomainEvent>) =>
  (areaId: string): ReadonlyArray<Equipment> =>
    pipe(
      events,
      RA.filter(isEventOfType('EquipmentAdded')),
      RA.filter(event => event.areaId === areaId)
    );
