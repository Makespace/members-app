/**
 * @jest-environment jsdom
 */

import * as O from 'fp-ts/Option';
import {render} from '../../../src/queries/member/render';
import {ViewModel} from '../../../src/queries/member/view-model';
import {EmailAddress, GravatarHash} from '../../../src/types';
import { faker } from '@faker-js/faker/locale/af_ZA';
import { UUID } from 'io-ts-types';

const primaryEmail = 'primary@example.com' as EmailAddress;
const unverifiedEmail = 'extra@example.com' as EmailAddress;
const verifiedSecondaryEmail = 'verified@example.com' as EmailAddress;

const buildViewModel = (isSuperUser: boolean, isSelf: boolean): ViewModel => ({
  member: {
    userId: faker.string.uuid() as UUID,
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
    joined: new Date('2025-01-01T00:00:00.000Z'),
    trainedOn: [],
    trainerFor: [],
    ownerOf: [],
  },
  user: isSelf ? {
    memberNumber: 123,
    emailAddress: primaryEmail,
  } : {
    memberNumber: 999,
    emailAddress: 'viewer@example.com' as EmailAddress,
  },
  isSelf,
  isSuperUser,
  trainingMatrix: [],
  recurlyStatus: 'active',
});

const renderPage = (viewModel: ViewModel): HTMLBodyElement => {
  const body = document.createElement('body');
  body.innerHTML = render(viewModel);
  return body;
};

describe('member render', () => {
  describe('as super user', () => {
    let viewModel: ViewModel;
    let page: HTMLBodyElement;
    beforeEach(() => {
      viewModel = buildViewModel(true, false);
      page = renderPage(viewModel);
    });

    it('shows the add email action', () => {
      expect(
        page.querySelector<HTMLAnchorElement>(
          'a[href="/members/add-email?member=123"]'
        )!.textContent
      ).toContain('Add New Email');
    });

    it('shows the same email table shape used on /me', () => {
      expect(page.textContent).toContain('Email addresses');
      expect(page.textContent).toContain(primaryEmail);
      expect(page.textContent).toContain(verifiedSecondaryEmail);
      expect(page.textContent).toContain(unverifiedEmail);
      expect(page.textContent).toContain('Primary');
      expect(page.textContent).toContain('Send Verification Email');
      expect(page.textContent).toContain('Make Primary Email');
    });
  });

  describe('as self', () => {
    let viewModel: ViewModel;
    let page: HTMLBodyElement;
    beforeEach(() => {
      viewModel = buildViewModel(false, true);
      page = renderPage(viewModel);
    });

    it('shows the add email action', () => {
      expect(
        page.querySelector<HTMLAnchorElement>(
          'a[href="/members/add-email?member=123"]'
        )!.textContent
      ).toContain('Add New Email');
    });
  });

  describe('non-superuser non-self', () => {
    let viewModel: ViewModel;
    let page: HTMLBodyElement;
    beforeEach(() => {
      viewModel = buildViewModel(false, false);
      page = renderPage(viewModel);
    });

    it('does not show the add email action', () => {
      expect(page.querySelector<HTMLAnchorElement>(
        'a[href="/members/add-email?member=123"]'
      )).toBeNull();
    });
  });
});
