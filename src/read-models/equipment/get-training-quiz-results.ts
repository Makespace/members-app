import {pipe} from 'fp-ts/lib/function';
import * as RA from 'fp-ts/ReadonlyArray';
import * as O from 'fp-ts/Option';
import {DomainEvent, isEventOfType} from '../../types';
import {EventOfType} from '../../types/domain-event';

export const getTrainingQuizResults =
  (events: ReadonlyArray<DomainEvent>) =>
  (
    equipmentId: string,
    trainingSheetId: O.Option<string>
  ): {
    passed: ReadonlyArray<EventOfType<'EquipmentTrainingQuizResult'>>;
    all: ReadonlyArray<EventOfType<'EquipmentTrainingQuizResult'>>;
  } =>
    pipe(
      events,
      RA.filter(isEventOfType('EquipmentTrainingQuizResult')),
      RA.filter(event => {
        if (O.isSome(trainingSheetId)) {
          return (
            event.equipmentId === equipmentId &&
            event.trainingSheetId === trainingSheetId.value
          );
        }
        return event.equipmentId === equipmentId;
      }),
      RA.reduce(
        {
          passed: [] as EventOfType<'EquipmentTrainingQuizResult'>[],
          all: [] as EventOfType<'EquipmentTrainingQuizResult'>[],
        },
        (result, event) => {
          if (event.fullMarks) {
            result.passed.push(event);
          }
          result.all.push(event);
          return result;
        }
      )
    );
