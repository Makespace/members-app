import {Eq} from 'fp-ts/lib/Eq';
import {EventOfType} from '../types/domain-event';
import {getEq} from 'fp-ts/lib/ReadonlyRecord';
import {string} from 'fp-ts';

export type QzEvent = EventOfType<'EquipmentTrainingQuizResult'>;
export type RegEvent = EventOfType<'EquipmentTrainingSheetRegistered'>;

export const NullableStringEq: Eq<string | null> = {
  equals(x: string | null, y: string | null) {
    if (x === null || y === null) {
      return x === y;
    }
    return string.Eq.equals(x, y);
  },
};

export const QzEventDuplicate: Eq<QzEvent> = {
  equals: (a: QzEvent, b: QzEvent) =>
    getEq(NullableStringEq).equals(a.quizAnswers, b.quizAnswers) &&
    a.timestampEpochS === b.timestampEpochS &&
    a.trainingSheetId === b.trainingSheetId,
};
