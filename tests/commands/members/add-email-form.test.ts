/**
 * @jest-environment jsdom
 */

import {addEmailForm} from '../../../src/commands/members/add-email-form';
import {arbitraryUser} from '../../types/user.helper';

describe('add email form', () => {
  it('submits the selected member number when an admin adds an email for another member', () => {
    const loggedInUser = arbitraryUser();
    const selectedMemberNumber = loggedInUser.memberNumber + 1;

    const rendered = addEmailForm.renderForm({
      user: loggedInUser,
      memberNumber: selectedMemberNumber,
    });

    const body = document.createElement('body');
    body.innerHTML = rendered.body;

    const memberNumberInput = body.querySelector<HTMLInputElement>(
      'input[name="memberNumber"]'
    );

    expect(memberNumberInput!.value).toStrictEqual(
      selectedMemberNumber.toString()
    );
  });
});