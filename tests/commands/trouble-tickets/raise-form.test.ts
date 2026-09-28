/**
 * @jest-environment jsdom
 */
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {raise} from '../../../src/commands/trouble-tickets/raise';
import {raiseForm} from '../../../src/commands/trouble-tickets/raise-form';

// The form and the command each had their own idea of what "not listed"
// posts, and the tests checked each against itself. This one feeds what the
// form actually posts into what the command actually accepts.
describe('the report-a-problem form and its command', () => {
  const page = () => {
    const body = document.createElement('body');
    body.innerHTML = raiseForm.renderForm({
      areas: [{id: 'area-1', name: 'Wood Shop'}],
      equipment: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          name: 'Bandsaw',
          areaId: 'area-1',
          areaName: 'Wood Shop',
          machineNames: [],
        },
      ],
      selectedEquipmentId: O.none,
      selectedAreaId: O.none,
    }).body;
    return body;
  };

  const notListedValue = () => {
    const option = [
      ...page().querySelectorAll<HTMLOptionElement>(
        'select[name="equipmentId"] option'
      ),
    ].find(candidate => candidate.textContent?.includes('not listed'));
    if (!option) {
      throw new Error('no "not listed" option on the form');
    }
    return option.value;
  };

  it('agree on what "not listed" posts', () => {
    const decoded = raise.decode({
      equipmentId: notListedValue(),
      otherEquipmentDetail: 'The vice by the door',
      machineStatuses: ['Consumables needed'],
      attempting: 'n/a',
      issue: 'We need more gloves',
      steps: 'n/a',
    });

    expect(E.isRight(decoded)).toBe(true);
  });

  it('still refuse "not listed" with nothing described', () => {
    const decoded = raise.decode({
      equipmentId: notListedValue(),
      otherEquipmentDetail: '',
      machineStatuses: [],
      attempting: '',
      issue: 'We need more gloves',
      steps: '',
    });

    expect(E.isLeft(decoded)).toBe(true);
  });
});
