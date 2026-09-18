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
  response: {
    otherEquipmentDetail: '',
    status: 'Broken',
    attempting: 'Printing a part',
    issue: 'Nozzle clogged',
    steps: 'Cleaned the bed',
  },
});

describe('troubleTicketRowHash', () => {
  it('is deterministic for identical input', () => {
    expect(troubleTicketRowHash(baseInput())).toStrictEqual(
      troubleTicketRowHash(baseInput())
    );
  });

  it.each<[string, Partial<TroubleTicketRowHashInput>]>([
    ['sheetId', {sheetId: 'different'}],
    ['submittedAt', {submittedAt: new Date('2024-02-15T10:30:00.000Z')}],
    ['submittedEmail', {submittedEmail: 'different@example.com'}],
    ['submittedMemberNumber', {submittedMemberNumber: 99}],
    ['submittedEquipment', {submittedEquipment: 'different'}],
    [
      'response',
      {response: {...baseInput().response, issue: 'different issue'}},
    ],
  ])('changes when %s changes', (_field, override) => {
    const changed: TroubleTicketRowHashInput = {...baseInput(), ...override};
    expect(troubleTicketRowHash(changed)).not.toStrictEqual(
      troubleTicketRowHash(baseInput())
    );
  });

  it('does not depend on the sync worker question-string keys', () => {
    // The hash is derived from the parsed answer values, so re-keying the
    // cached JSON (e.g. fixing the truncated sheet headers) must not change it.
    // This is what makes the hash safe against sheet-header edits.
    expect(troubleTicketRowHash(baseInput())).toStrictEqual(
      troubleTicketRowHash({...baseInput(), response: {...baseInput().response}})
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

  it('treats null and empty-string equipment as the same submission', () => {
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
