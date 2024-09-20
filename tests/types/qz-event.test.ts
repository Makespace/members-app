import {v4} from 'uuid';
import {QzEvent, QzEventDuplicate} from '../../src/types/qz-event';
import {UUID} from 'io-ts-types';
import {DomainEvent} from '../../src/types';
import {getRightOrFail} from '../helpers';
import {EpochTimestampMilliseconds} from '../../src/read-models/shared-state/return-types';

const EVENT_1: QzEvent = {
  equipmentId: v4() as UUID,
  trainingSheetId: 'sheetid123',
  memberNumberProvided: 1233,
  emailProvided: 'finn.flatcoat@dogs.com',
  score: 2,
  id: v4() as UUID,
  recordedAt: new Date(2024, 6, 6, 13, 42, 0),
  maxScore: 10,
  percentage: 20,
  timestampEpochMS: 1520652364_000 as EpochTimestampMilliseconds,
  quizAnswers: {
    q1: 'a1',
    q2: 'a2',
    q3: 'a3',
  },
  type: 'EquipmentTrainingQuizResult',
  actor: {
    tag: 'system',
  },
};

const EVENT_2: QzEvent = {
  equipmentId: v4() as UUID,
  trainingSheetId: 'sheetid123',
  memberNumberProvided: 1244,
  emailProvided: 'beans@bob.com',
  score: 7,
  id: v4() as UUID,
  recordedAt: new Date(2024, 5, 8, 13, 42, 0),
  maxScore: 10,
  percentage: 70,
  timestampEpochMS: 1520652999_000 as EpochTimestampMilliseconds,
  quizAnswers: {
    q1: 'a1',
    q2: 'a7',
    q3: 'a9',
  },
  type: 'EquipmentTrainingQuizResult',
  actor: {
    tag: 'system',
  },
};

describe('QzEvent', () => {
  it('Check simple duplicate', () => {
    expect(QzEventDuplicate.equals(EVENT_1, EVENT_1)).toBeTruthy();
  });
  it('Check different object simple duplicate', () => {
    expect(
      QzEventDuplicate.equals(
        getRightOrFail(
          DomainEvent.decode(DomainEvent.encode(EVENT_1))
        ) as QzEvent,
        getRightOrFail(
          DomainEvent.decode(DomainEvent.encode(EVENT_1))
        ) as QzEvent
      )
    ).toBeTruthy();
  });
  it('Check distinct', () => {
    expect(QzEventDuplicate.equals(EVENT_1, EVENT_2)).toBeFalsy();
  });
});
