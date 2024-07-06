import {Eq} from 'fp-ts/lib/Eq';
import {EventOfType} from '../types/domain-event';

export type QzEvent = EventOfType<'EquipmentTrainingQuizResult'>;
export type RegEvent = EventOfType<'EquipmentTrainingSheetRegistered'>;

export const QzEventDuplicate: Eq<QzEvent> = {
  equals: (a: QzEvent, b: QzEvent) =>
    a.quizAnswers === b.quizAnswers &&
    a.timestampEpochS === b.timestampEpochS &&
    a.trainingSheetId === b.trainingSheetId,
};
