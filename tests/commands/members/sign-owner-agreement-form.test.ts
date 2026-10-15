/**
 * @jest-environment jsdom
 */

import * as E from 'fp-ts/Either';
import {signOwnerAgreementForm} from '../../../src/commands/members/sign-owner-agreement-form';
import {ownerAgreementPages} from '../../../src/commands/members/owner-agreement';
import {arbitraryUser} from '../../types/user.helper';

const lastStep = ownerAgreementPages.length;
const equipmentStep =
  ownerAgreementPages.findIndex(page => page.choices?.name === 'equipment') + 1;
const areaStep =
  ownerAgreementPages.findIndex(page => page.choices?.name === 'area') + 1;

const picked = {equipment: 'training', area: 'budget'};

const constructFromQuery = async (query: unknown) => {
  const result = await signOwnerAgreementForm.constructForm(query)({
    user: arbitraryUser(),
  } as never)();
  if (E.isLeft(result)) {
    throw new Error('constructForm failed');
  }
  return result.right;
};

const renderQuery = async (query: unknown) => {
  const rendered = signOwnerAgreementForm.renderForm(
    await constructFromQuery(query)
  );
  const body = document.createElement('body');
  body.innerHTML = rendered.body;
  return body;
};

describe('sign owner agreement form', () => {
  it('redirects signing members to /me on success so non-admins do not land on the admin-only /members page', async () => {
    const page = await renderQuery({...picked, step: String(lastStep)});
    const form = page.querySelector<HTMLFormElement>('form[method="post"]');

    expect(form!.getAttribute('action')).toStrictEqual('?next=/me');
  });

  it('only offers the sign button on the last page', async () => {
    for (let step = 1; step < lastStep; step++) {
      const page = await renderQuery({...picked, step: String(step)});
      expect(page.querySelector('form[method="post"]')).toBeNull();
    }
  });

  it('marks the page being read as the current step', async () => {
    const page = await renderQuery({...picked, step: '3'});
    const current = page.querySelector('[aria-current="step"]');

    expect(current!.textContent).toContain(ownerAgreementPages[2].label);
  });

  it.each([
    [{}, 1],
    [{step: '0'}, 1],
    [{step: String(lastStep + 1)}, 1],
    [{step: 'nonsense'}, 1],
  ])('reads %j as page %i', async (query, expected) => {
    expect((await constructFromQuery(query)).step).toStrictEqual(expected);
  });

  describe('responsibility pages', () => {
    it('sends someone skipping ahead back to the first page still needing a pick', async () => {
      const viewModel = await constructFromQuery({step: String(lastStep)});

      expect(viewModel.step).toStrictEqual(equipmentStep);
      expect(viewModel.sentBack).toBe(true);
    });

    it('sends them back to the area page when only equipment is picked', async () => {
      const viewModel = await constructFromQuery({
        step: String(lastStep),
        equipment: 'training',
      });

      expect(viewModel.step).toStrictEqual(areaStep);
    });

    it('lets them reach the last page once both are picked', async () => {
      const viewModel = await constructFromQuery({
        ...picked,
        step: String(lastStep),
      });

      expect(viewModel.step).toStrictEqual(lastStep);
      expect(viewModel.sentBack).toBe(false);
    });

    it('does not send anyone back from pages before the first pick', async () => {
      const viewModel = await constructFromQuery({step: String(equipmentStep)});

      expect(viewModel.step).toStrictEqual(equipmentStep);
      expect(viewModel.sentBack).toBe(false);
    });

    it('ignores responsibilities that are not on the page', async () => {
      const viewModel = await constructFromQuery({
        step: String(areaStep),
        equipment: ['nonsense', 'maintenance'],
      });

      expect(viewModel.selections.equipment).toStrictEqual(['maintenance']);
    });

    it('explains why someone was sent back', async () => {
      const page = await renderQuery({step: String(lastStep)});

      expect(page.querySelector('[role="alert"]')).not.toBeNull();
    });

    it('keeps earlier picks ticked and carries them forward', async () => {
      const page = await renderQuery({
        step: String(areaStep),
        equipment: ['training', 'maintenance'],
      });
      const carried = Array.from(
        page.querySelectorAll<HTMLInputElement>(
          'input[type="hidden"][name="equipment"]'
        )
      ).map(input => input.value);

      expect(carried).toStrictEqual(['training', 'maintenance']);
      expect(
        page.querySelector<HTMLInputElement>('input[name="step"]')!.value
      ).toStrictEqual(String(areaStep + 1));
    });

    it('shows previous picks as ticked when coming back to a page', async () => {
      const page = await renderQuery({
        step: String(equipmentStep),
        equipment: 'maintenance',
      });

      expect(
        page.querySelector<HTMLInputElement>('input[value="maintenance"]')!
          .checked
      ).toBe(true);
      expect(
        page.querySelector<HTMLInputElement>('input[value="training"]')!.checked
      ).toBe(false);
    });
  });
});
