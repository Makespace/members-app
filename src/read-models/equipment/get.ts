import {pipe} from 'fp-ts/lib/function';
import * as O from 'fp-ts/Option';
import {DomainEvent, isEventOfType} from '../../types';
import * as RA from 'fp-ts/ReadonlyArray';

type Equipment = {
  name: string;
};

export const get =
  (events: ReadonlyArray<DomainEvent>) =>
  (equipmentId: string): O.Option<Equipment> =>
    pipe(
      events,
      RA.filter(isEventOfType('EquipmentAdded')),
      RA.filter(event => event.id === equipmentId),
      RA.head
    );
