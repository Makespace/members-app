/**
 * @jest-environment jsdom
 */

import * as O from 'fp-ts/Option';
import {render} from '../../../src/queries/me/render';
import {ViewModel} from '../../../src/queries/me/view-model';
import {EmailAddress, GravatarHash} from '../../../src/types';

const renderPage = (viewModel: ViewModel) => {
  const rendered = render(viewModel);
  const body = document.createElement('body');
  body.innerHTML = rendered;
  return body;
};

describe('/me render', () => {
  const primaryEmail = 'primary@example.com' as EmailAddress;
  const unverifiedEmail = 'extra@example.com' as EmailAddress;
  const verifiedSecondaryEmail = 'verified@example.com' as EmailAddress;
  const viewModel: ViewModel = {
    member: {
      memberNumber: 123,
      pastMemberNumbers: [],
      primaryEmailAddress: primaryEmail,
      emails: [
        {
          emailAddress: primaryEmail,
          verifiedAt: O.some(new Date('2025-01-01T00:00:00.000Z')),
          addedAt: new Date('2025-01-01T00:00:00.000Z'),
        },
        {
          emailAddress: unverifiedEmail,
          verifiedAt: O.none,
          addedAt: new Date('2025-01-02T00:00:00.000Z'),
        },
        {
          emailAddress: verifiedSecondaryEmail,
          verifiedAt: O.some(new Date('2025-01-03T00:00:00.000Z')),
          addedAt: new Date('2025-01-03T00:00:00.000Z'),
        },
      ],
      name: O.none,
      formOfAddress: O.none,
      agreementSigned: O.none,
      isSuperUser: false,
      superUserSince: O.none,
      gravatarHash: 'hash' as unknown as GravatarHash,
      status: 'active',
      joined: new Date('2025-01-01T00:00:00.000Z'),
      trainedOn: [],
      trainerFor: [],
      ownerOf: [],
    },
    trainingMatrix: [],
  };

  it('shows the primary email and all email addresses', () => {
    const page = renderPage(viewModel);
    expect(page.textContent).toContain('Primary email');
    expect(page.textContent).toContain(primaryEmail);
    expect(page.textContent).toContain(unverifiedEmail);
    expect(page.textContent).toContain(verifiedSecondaryEmail);
  });

  it('shows the right actions for unverified and verified non-primary emails', () => {
    const page = renderPage(viewModel);
    expect(page.textContent).toContain('Send verification email');
    expect(page.textContent).toContain('Make primary');
  });
});
