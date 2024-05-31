import {pipe} from 'fp-ts/lib/function';
import * as RA from 'fp-ts/ReadonlyArray';
import * as O from 'fp-ts/Option';
import {DomainEvent, isEventOfType} from '../../types';

export const getTrainingSheetId =
  (events: ReadonlyArray<DomainEvent>) =>
  (equipmentId: string): O.Option<string> =>
    pipe(
      events,
      RA.filter(isEventOfType('EquipmentTrainingSheetRegistered')),
      RA.filter(event => event.equipmentId == equipmentId),
      events => events.length > 0 ? O.some(events[-1].trainingSheetId) : O.none,
    );
