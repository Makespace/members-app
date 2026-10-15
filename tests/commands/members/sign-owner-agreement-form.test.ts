/**
 * @jest-environment jsdom
 */

import * as E from 'fp-ts/Either';
import {signOwnerAgreementForm} from '../../../src/commands/members/sign-owner-agreement-form';
import {ownerAgreementPages} from '../../../src/commands/members/owner-agreement';
import {arbitraryUser} from '../../types/user.helper';

const lastStep = ownerAgreementPages.length;

const renderStep = (step: number) => {
  const rendered = signOwnerAgreementForm.renderForm({
    user: arbitraryUser(),
    step,
  });
  const body = document.createElement('body');
  body.innerHTML = rendered.body;
  return body;
};

const stepFromQuery = async (query: unknown) => {
  const result = await signOwnerAgreementForm.constructForm(query)({
    user: arbitraryUser(),
  } as never)();
  if (E.isLeft(result)) {
    throw new Error('constructForm failed');
  }
  return result.right.step;
};

describe('sign owner agreement form', () => {
  it('redirects signing members to /me on success so non-admins do not land on the admin-only /members page', () => {
    const form = renderStep(lastStep).querySelector<HTMLFormElement>('form');

    expect(form!.getAttribute('action')).toStrictEqual('?next=/me');
  });

  it('only offers the sign button on the last page', () => {
    for (let step = 1; step < lastStep; step++) {
      expect(renderStep(step).querySelector('form')).toBeNull();
    }
  });

  it('links each page on to the next', () => {
    const next = renderStep(1).querySelector('.agreement-nav a.button');

    expect(next!.getAttribute('href')).toStrictEqual('?step=2');
  });

  it('marks the page being read as the current step', () => {
    const current = renderStep(3).querySelector('[aria-current="step"]');

    expect(current!.textContent).toContain(ownerAgreementPages[2].label);
  });

  it.each([
    [{}, 1],
    [{step: '3'}, 3],
    [{step: '0'}, 1],
    [{step: String(lastStep + 1)}, 1],
    [{step: 'nonsense'}, 1],
  ])('reads %j as page %i', async (query, expected) => {
    expect(await stepFromQuery(query)).toStrictEqual(expected);
  });
});
