import {Eq} from 'fp-ts/lib/Eq';
import {EventOfType} from './domain-event';
import {getEq} from 'fp-ts/lib/ReadonlyRecord';
import {NullableStringEq} from './nullable-string';

export type QzEvent = EventOfType<'EquipmentTrainingQuizResult'>;
export type RegEvent = EventOfType<'EquipmentTrainingSheetRegistered'>;

export const QzEventDuplicate: Eq<QzEvent> = {
  equals: (a: QzEvent, b: QzEvent) =>
    getEq(NullableStringEq).equals(a.quizAnswers, b.quizAnswers) &&
    a.timestampEpochMS === b.timestampEpochMS &&
    a.trainingSheetId === b.trainingSheetId,
};
