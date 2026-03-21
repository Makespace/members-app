/**
 * @jest-environment jsdom
 */

import * as O from 'fp-ts/Option';
import {render} from '../../../src/queries/member/render';
import {ViewModel} from '../../../src/queries/member/view-model';
import {EmailAddress, GravatarHash} from '../../../src/types';

const primaryEmail = 'primary@example.com' as EmailAddress;
const unverifiedEmail = 'extra@example.com' as EmailAddress;
const verifiedSecondaryEmail = 'verified@example.com' as EmailAddress;

const buildViewModel = (isSuperUser: boolean): ViewModel => ({
  member: {
    memberNumber: 123,
    pastMemberNumbers: [122],
    primaryEmailAddress: primaryEmail,
    emails: [
      {
        emailAddress: primaryEmail,
        verifiedAt: O.some(new Date('2025-01-01T00:00:00.000Z')),
        addedAt: new Date('2025-01-01T00:00:00.000Z'),
        verificationLastSent: O.none,
      },
      {
        emailAddress: unverifiedEmail,
        verifiedAt: O.none,
        addedAt: new Date('2025-01-02T00:00:00.000Z'),
        verificationLastSent: O.none,
      },
      {
        emailAddress: verifiedSecondaryEmail,
        verifiedAt: O.some(new Date('2025-01-03T00:00:00.000Z')),
        addedAt: new Date('2025-01-03T00:00:00.000Z'),
        verificationLastSent: O.none,
      },
    ],
    name: O.none,
    formOfAddress: O.none,
    agreementSigned: O.none,
    isSuperUser,
    superUserSince: O.none,
    gravatarHash: 'hash' as unknown as GravatarHash,
    status: 'active',
    joined: new Date('2025-01-01T00:00:00.000Z'),
    trainedOn: [],
    trainerFor: [],
    ownerOf: [],
  },
  user: {
    memberNumber: 999,
    emailAddress: 'viewer@example.com' as EmailAddress,
  },
  isSelf: false,
  isSuperUser,
  trainingMatrix: [],
});

const renderPage = (viewModel: ViewModel) => {
  const rendered = render(viewModel);
  const body = document.createElement('body');
  body.innerHTML = rendered;
  return body;
};

describe('member render', () => {
  it('shows the same email table shape used on /me', () => {
    const page = renderPage(buildViewModel(true));

    expect(page.textContent).toContain('Email addresses');
    expect(page.textContent).toContain(primaryEmail);
    expect(page.textContent).toContain(verifiedSecondaryEmail);
    expect(page.textContent).toContain(unverifiedEmail);
    expect(page.textContent).toContain('Primary');
    expect(page.textContent).not.toContain('Send Verification Email');
    expect(page.textContent).not.toContain('Make Primary Email');
  });

  it('shows the add email action to super users', () => {
    const page = renderPage(buildViewModel(true));
    const addEmailLink = page.querySelector<HTMLAnchorElement>(
      'a[href="/members/add-email?member=123"]'
    );

    expect(addEmailLink?.textContent).toContain('Add New Email');
  });

  it('does not show the add email action to non-super users', () => {
    const page = renderPage(buildViewModel(false));
    const addEmailLink = page.querySelector<HTMLAnchorElement>(
      'a[href="/members/add-email?member=123"]'
    );

    expect(addEmailLink).toBeNull();
  });
});
