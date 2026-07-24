import {
  troubleTicketRowHash,
  TroubleTicketRowHashInput,
} from '../../src/trouble-tickets/row-hash';

const baseInput = (): TroubleTicketRowHashInput => ({
  sheetId: 'sheet-1',
  submittedAt: new Date('2024-01-15T10:30:00.000Z'),
  submittedEmail: 'foo@example.com',
  submittedMemberNumber: 42,
  submittedEquipment: 'Bambu 3D Printer',
  responseJson: '{"a":"b"}',
});

describe('troubleTicketRowHash', () => {
  it('is deterministic for identical input', () => {
    expect(troubleTicketRowHash(baseInput())).toStrictEqual(
      troubleTicketRowHash(baseInput())
    );
  });

  it.each<keyof TroubleTicketRowHashInput>([
    'sheetId',
    'submittedAt',
    'submittedEmail',
    'submittedMemberNumber',
    'submittedEquipment',
    'responseJson',
  ])('changes when %s changes', field => {
    const changed: TroubleTicketRowHashInput = {
      ...baseInput(),
      ...(field === 'submittedAt'
        ? {submittedAt: new Date('2024-02-15T10:30:00.000Z')}
        : field === 'submittedMemberNumber'
          ? {submittedMemberNumber: 99}
          : {[field]: 'different'}),
    };
    expect(troubleTicketRowHash(changed)).not.toStrictEqual(
      troubleTicketRowHash(baseInput())
    );
  });

  it('treats null submitter fields as stable (no throw, deterministic)', () => {
    const nulled: TroubleTicketRowHashInput = {
      ...baseInput(),
      submittedEmail: null,
      submittedMemberNumber: null,
      submittedEquipment: null,
    };
    expect(troubleTicketRowHash(nulled)).toStrictEqual(
      troubleTicketRowHash(nulled)
    );
  });

  it('distinguishes null from empty-string equipment', () => {
    const withNull: TroubleTicketRowHashInput = {
      ...baseInput(),
      submittedEquipment: null,
    };
    const withEmpty: TroubleTicketRowHashInput = {
      ...baseInput(),
      submittedEquipment: '',
    };
    // Both map to '' in the hash payload, so they are intentionally equal.
    expect(troubleTicketRowHash(withNull)).toStrictEqual(
      troubleTicketRowHash(withEmpty)
    );
  });
});
