import {pipe} from 'fp-ts/lib/function';
import * as RA from 'fp-ts/ReadonlyArray';
import {DomainEvent, isEventOfType} from '../../types';
import {EventOfType} from '../../types/domain-event';

export const getTrainingQuizResults =
  (events: ReadonlyArray<DomainEvent>) =>
  (
    equipmentId: string
  ): ReadonlyArray<EventOfType<'EquipmentTrainingQuizResult'>> =>
    pipe(
      events,
      RA.filter(isEventOfType('EquipmentTrainingQuizResult')),
      RA.filter(event => {
        return event.equipmentId === equipmentId;
      })
    );
