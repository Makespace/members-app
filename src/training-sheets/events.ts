import {Eq} from 'fp-ts/lib/Eq';
import {EventOfType} from '../types/domain-event';

export type QzEvent = EventOfType<'EquipmentTrainingQuizResult'>;
export type RegEvent = EventOfType<'EquipmentTrainingSheetRegistered'>;

export const QzEventDuplicate: Eq<QzEvent> = {
  equals: (a: QzEvent, b: QzEvent) =>
    a.email === b.email &&
    a.timestampEpochS === b.timestampEpochS &&
    a.score === b.score &&
    a.equipmentId === b.equipmentId &&
    a.trainingSheetId === b.trainingSheetId,
};
