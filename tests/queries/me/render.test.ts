/**
 * @jest-environment jsdom
 */

import * as O from 'fp-ts/Option';
import {render} from '../../../src/queries/me/render';
import {ViewModel} from '../../../src/queries/me/view-model';
import {EmailAddress, GravatarHash} from '../../../src/types';
import { faker } from '@faker-js/faker/locale/af_ZA';
import { UUID } from 'io-ts-types';

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
      userId: faker.string.uuid() as UUID,
      memberNumber: 123,
      pastMemberNumbers: [],
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
      isSuperUser: false,
      superUserSince: O.none,
      gravatarHash: 'hash' as unknown as GravatarHash,
      joined: new Date('2025-01-01T00:00:00.000Z'),
      trainedOn: [],
      trainerFor: [],
      ownerOf: [],
    },
    trainingMatrix: [],
  };

  it('shows the primary email and all email addresses', () => {
    const page = renderPage(viewModel);
    expect(page.textContent).toContain('Primary');
    expect(page.textContent).toContain(primaryEmail);
    expect(page.textContent).toContain(unverifiedEmail);
    expect(page.textContent).toContain(verifiedSecondaryEmail);
  });

  it('shows the right actions for unverified and verified non-primary emails', () => {
    const page = renderPage(viewModel);
    expect(page.textContent).toContain('Send Verification Email');
    expect(page.textContent).toContain('Make Primary Email');
  });
});
