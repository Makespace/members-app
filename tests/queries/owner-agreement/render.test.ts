/**
 * @jest-environment jsdom
 */

import * as O from 'fp-ts/Option';
import {render} from '../../../src/queries/owner-agreement/render';
import {
  agreementVersions,
  currentAgreement,
  ORIGINAL_AGREEMENT_KEY,
} from '../../../src/owner-agreement/versions';
import {SignedOwnerAgreement} from '../../../src/owner-agreement/agreement';

const original = agreementVersions.find(
  version => version.key === ORIGINAL_AGREEMENT_KEY
)!;

const signedCurrent: O.Option<SignedOwnerAgreement> = O.some({
  version: currentAgreement.key,
  signedAt: new Date('2026-11-01T10:00:00.000Z'),
  termEnds: O.some(new Date('2027-05-01T10:00:00.000Z')),
  interestedIn: {equipment: ['maintenance'], area: []},
  reminderSent: O.none,
});

const renderPage = (...args: Parameters<typeof render>) => {
  const body = document.createElement('body');
  body.innerHTML = render(...args);
  return body;
};

const text = (page: HTMLElement) =>
  (page.textContent ?? '').replace(/\s+/g, ' ');

describe('reading back the owner agreement', () => {
  const now = new Date('2027-01-01T10:00:00.000Z');

  it('shows the whole agreement with no sign button', () => {
    const page = renderPage({
      version: currentAgreement,
      signed: signedCurrent,
      now,
    });
    expect(text(page)).toContain('Revoking training if necessary');
    expect(text(page)).toContain('Owners are not individually liable');
    expect(page.querySelector('form')).toBeNull();
  });

  it('says when they signed it and marks what they picked', () => {
    const page = renderPage({
      version: currentAgreement,
      signed: signedCurrent,
      now,
    });
    expect(text(page)).toContain('You signed this version on');
    const picked = page.querySelectorAll('.card-grid__picked');
    expect(picked).toHaveLength(1);
    expect(picked[0].textContent).toContain('Maintenance');
  });

  it('can show an earlier version, pointing to the current one', () => {
    const page = renderPage({version: original, signed: signedCurrent, now});
    expect(text(page)).toContain('This is an earlier version');
    expect(page.querySelectorAll('.card-grid__picked')).toHaveLength(0);
  });

  it('lists every version', () => {
    const page = renderPage({version: original, signed: O.none, now});
    expect(page.querySelectorAll('h2 + ul li')).toHaveLength(
      agreementVersions.length
    );
  });
});
