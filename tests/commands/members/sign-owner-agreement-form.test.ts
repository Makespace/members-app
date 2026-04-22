/**
 * @jest-environment jsdom
 */

import {signOwnerAgreementForm} from '../../../src/commands/members/sign-owner-agreement-form';
import {arbitraryUser} from '../../types/user.helper';

describe('sign owner agreement form', () => {
  it('redirects signing members to /me on success so non-admins do not land on the admin-only /members page', () => {
    const rendered = signOwnerAgreementForm.renderForm({user: arbitraryUser()});

    const body = document.createElement('body');
    body.innerHTML = rendered.body;

    const form = body.querySelector<HTMLFormElement>('form');

    expect(form!.getAttribute('action')).toStrictEqual('?next=/me');
  });
});
