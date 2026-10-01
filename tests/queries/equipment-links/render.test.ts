/**
 * @jest-environment jsdom
 */

import * as O from 'fp-ts/Option';
import {UUID} from 'io-ts-types';
import {render} from '../../../src/queries/equipment-links/render';
import {ViewModel} from '../../../src/queries/equipment-links/view-model';

const id = (n: string) => `0000000${n}-0000-4000-8000-000000000000` as UUID;

const viewModel: ViewModel = {
  missing: [
    {
      id: id('2'),
      name: 'Belt Sander',
      areaName: 'Wood Shop',
      guideUrl: O.some('https://equipment.makespace.org/wood-shop/belt-sander'),
      riskAssessmentUrl: O.none,
    },
  ],
  complete: [
    {
      id: id('1'),
      name: 'Band Saw',
      areaName: 'Wood Shop',
      guideUrl: O.some('https://equipment.makespace.org/wood-shop/band-saw'),
      riskAssessmentUrl: O.some('https://docs.google.com/spreadsheets/d/abc/edit'),
    },
  ],
  total: 2,
  withGuide: 2,
  withRiskAssessment: 1,
};

const page = () => {
  const body = document.createElement('body');
  body.innerHTML = render(viewModel);
  return body;
};

describe('the equipment links table', () => {
  it('says how many machines have each', () => {
    expect(page().textContent?.replace(/\s+/g, ' ')).toContain(
      'Risk assessment: 1 of 2'
    );
  });

  it('offers a box to fill in the gap, not a trip to another page', () => {
    const form = page().querySelector<HTMLFormElement>(
      'form[action^="/equipment/set-risk-assessment-url"]'
    );
    expect(form).not.toBeNull();
    expect(form?.querySelector('input[name="riskAssessmentUrl"]')).not.toBeNull();
    expect(
      form?.querySelector<HTMLInputElement>('input[name="equipmentId"]')?.value
    ).toBe(id('2'));
  });

  // Somebody filling gaps is working down a list; dropping them on the
  // machine's page would lose their place every time.
  it('comes back here after saving', () => {
    const form = page().querySelector<HTMLFormElement>(
      'form[action^="/equipment/set-risk-assessment-url"]'
    );
    expect(form?.getAttribute('action')).toContain(
      `next=${encodeURIComponent('/equipment-links')}`
    );
  });

  it('shows where an existing link goes rather than its whole address', () => {
    const capsule = page().querySelector(
      'a[href="https://docs.google.com/spreadsheets/d/abc/edit"]'
    );
    expect(capsule?.textContent?.trim()).toBe('docs.google.com');
    expect(capsule?.getAttribute('title')).toBe(
      'https://docs.google.com/spreadsheets/d/abc/edit'
    );
  });

  // One input per gap, each needing to say which machine it belongs to.
  it('labels every box for a screen reader', () => {
    const inputs = page().querySelectorAll<HTMLInputElement>(
      '.eq-links__set input[type="url"]'
    );
    expect(inputs.length).toBeGreaterThan(0);
    inputs.forEach(input => {
      expect(page().querySelector(`label[for="${input.id}"]`)).not.toBeNull();
    });
  });

  it('does not offer a box where the link is already there', () => {
    const completeTable = page().querySelectorAll('table')[1];
    expect(completeTable?.querySelector('form')).toBeNull();
  });
});
