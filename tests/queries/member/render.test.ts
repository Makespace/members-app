/**
 * @jest-environment jsdom
 */

import * as O from 'fp-ts/Option';
import {render} from '../../../src/queries/member/render';
import {ViewModel} from '../../../src/queries/member/view-model';
import {EmailAddress, GravatarHash} from '../../../src/types';
import {MemberBilling} from '../../../src/read-models/external-state/recurly-billing';
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
  billing: O.none,
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

    it('shows the recurly status', () => {
      expect(page.querySelector('.tag--green')!.textContent).toStrictEqual(
        'active'
      );
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

const overdueBilling: MemberBilling = {
  invoices: [
    {
      id: 'inv_1',
      number: O.some('INV-9001'),
      state: 'past_due',
      collectionMethod: O.some('automatic'),
      currency: O.some('GBP'),
      total: O.some(25),
      paid: O.some(0),
      balance: O.some(25),
      createdAt: O.some(new Date('2026-08-01T00:00:00.000Z')),
      dueAt: O.some(new Date('2026-09-01T00:00:00.000Z')),
      dunningEventsSent: O.some(2),
      isOutstanding: true,
      daysOverdue: O.some(28),
      issues: ['expired-card'],
      attempts: [
        {
          at: O.some(new Date('2026-09-02T00:00:00.000Z')),
          succeeded: false,
          status: O.some('declined'),
          message: O.some('Your card has expired.'),
          cardType: O.some('Visa'),
          lastFour: O.some('4242'),
          expMonth: O.some(4),
          expYear: O.some(2026),
        },
      ],
    },
  ],
  daysOverdue: O.some(28),
  totalOutstanding: 25,
  currency: O.some('GBP'),
  lastPaidAt: O.some(new Date('2026-08-02T00:00:00.000Z')),
  cachedAt: O.some(new Date('2026-09-29T11:00:00.000Z')),
};

describe('the billing section', () => {
  const pageFor = (billing: ViewModel['billing'], isSuperUser: boolean) =>
    renderPage({...buildViewModel(isSuperUser, false), billing});

  it('shows a super user the invoices and why they are unpaid', () => {
    const page = pageFor(O.some(overdueBilling), true);
    expect(page.textContent).toContain('Billing');
    expect(page.textContent).toContain('INV-9001');
    expect(page.textContent).toContain('28 days');
    expect(page.textContent).toContain('Card expired');
    expect(page.textContent).toContain('Your card has expired.');
    expect(page.textContent).toContain('Visa ending 4242');
    expect(page.textContent).toContain('\u00a325.00');
  });

  // The view model is what keeps this out of other people's pages, so this is
  // the belt to that braces: even handed the data, a non-super-user's page
  // must not be where it shows up.
  it('shows nothing at all when the viewer is not a super user', () => {
    const page = pageFor(O.none, false);
    expect(page.textContent).not.toContain('Billing');
    expect(page.textContent).not.toContain('INV-9001');
    expect(page.textContent).not.toContain('4242');
  });

  it('shows nothing on your own page either', () => {
    const page = renderPage({...buildViewModel(false, true), billing: O.none});
    expect(page.textContent).not.toContain('Billing');
    expect(page.textContent).not.toContain('INV-9001');
  });

  it('says so plainly when there are no invoices against the member', () => {
    const page = pageFor(
      O.some({...overdueBilling, invoices: [], totalOutstanding: 0}),
      true
    );
    expect(page.textContent).toContain('No Recurly invoices are held');
  });

  it('does not unfold a reason for an invoice that is settled', () => {
    const settled = {
      ...overdueBilling,
      invoices: [
        {
          ...overdueBilling.invoices[0],
          state: 'paid',
          balance: O.some(0),
          isOutstanding: false,
          daysOverdue: O.none,
          issues: [],
        },
      ],
      totalOutstanding: 0,
      daysOverdue: O.none,
    };
    const page = pageFor(O.some(settled), true);
    expect(page.textContent).toContain('INV-9001');
    expect(page.textContent).not.toContain('Why this is unpaid');
  });
});
