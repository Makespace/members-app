import {DomainEvent} from '../../src/types/domain-event';
import {getRightOrFail} from '../helpers';

const baseEquipmentAdded = {
  type: 'EquipmentAdded',
  id: '11111111-1111-4111-8111-111111111111',
  name: 'A machine',
  areaId: '22222222-2222-4222-8222-222222222222',
  actor: {tag: 'system'},
  recordedAt: '2024-01-01T00:00:00.000Z',
};

describe('EquipmentAdded classification', () => {
  it('decodes a legacy event without a classification as Red', () => {
    const decoded = getRightOrFail(DomainEvent.decode(baseEquipmentAdded));
    expect((decoded as {classification: string}).classification).toStrictEqual(
      'Red'
    );
  });

  it('decodes a provided classification', () => {
    const decoded = getRightOrFail(
      DomainEvent.decode({...baseEquipmentAdded, classification: 'Orange'})
    );
    expect((decoded as {classification: string}).classification).toStrictEqual(
      'Orange'
    );
  });
});
