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
        linkedByAdmin: false,
      },
      {
        emailAddress: unverifiedEmail,
        verifiedAt: O.none,
        addedAt: new Date('2025-01-02T00:00:00.000Z'),
        verificationLastSent: O.none,
        linkedByAdmin: false,
      },
      {
        emailAddress: verifiedSecondaryEmail,
        verifiedAt: O.some(new Date('2025-01-03T00:00:00.000Z')),
        addedAt: new Date('2025-01-03T00:00:00.000Z'),
        verificationLastSent: O.none,
        linkedByAdmin: true,
      },
    ],
    fobs: [
      {
        fobId: 4321,
        accessLevel: 'Member',
        paxtonName: 'Molly 123 Millions',
        recordedAt: new Date('2025-01-04T00:00:00.000Z'),
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

    it('says when an address was linked from Recurly by an admin', () => {
      expect(page.textContent).toContain('linked from Recurly by admin');
    });

    it('shows the recurly status', () => {
      expect(page.querySelector('.tag--green')!.textContent).toStrictEqual(
        'active'
      );
    });

    it('shows the Paxton fobs with record and remove actions', () => {
      expect(page.textContent).toContain('Paxton fobs');
      expect(page.textContent).toContain('4321');
      expect(page.textContent).toContain('Molly 123 Millions');
      expect(
        page.querySelector('a[href="/members/record-fob?member=123"]')
      ).not.toBeNull();
      expect(
        page.querySelector('a[href="/members/remove-fob?member=123&fob=4321"]')
      ).not.toBeNull();
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

    it('does not show Paxton fobs, even their own', () => {
      expect(page.textContent).not.toContain('Paxton fobs');
      expect(page.textContent).not.toContain('Molly 123 Millions');
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

    it('does not show Paxton fobs', () => {
      expect(page.textContent).not.toContain('Paxton fobs');
      expect(page.textContent).not.toContain('Molly 123 Millions');
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

// jsdom keeps the template's newlines and indentation, so assertions compare
// against the words with the whitespace flattened out.
const text = (page: HTMLBodyElement): string =>
  (page.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('the billing section', () => {
  const pageFor = (billing: ViewModel['billing'], isSuperUser: boolean) =>
    renderPage({...buildViewModel(isSuperUser, false), billing});

  const settled = (over: Partial<MemberBilling['invoices'][number]> = {}) => ({
    ...overdueBilling.invoices[0],
    id: 'inv_paid',
    number: O.some('INV-8000'),
    state: 'paid',
    balance: O.some(0),
    isOutstanding: false,
    daysOverdue: O.none,
    issues: [],
    attempts: [],
    ...over,
  });

  it('leads with where the member stands', () => {
    const page = pageFor(O.some(overdueBilling), true);
    expect(text(page)).toContain('Outstanding: \u00a325.00');
    expect(text(page)).toContain('the oldest of it overdue by 28 days');
    expect(text(page)).toContain('Last paid');
  });

  it('gives each invoice a card rather than a table row', () => {
    const page = pageFor(O.some(overdueBilling), true);
    expect(page.querySelectorAll('.billing-card')).toHaveLength(1);
    // The billing section brings no table of its own; the one on the page is
    // the member's details.
    expect(page.querySelectorAll('.billing-cards table')).toHaveLength(0);
  });

  it('shows what is owed on an unpaid card, and why', () => {
    const page = pageFor(O.some(overdueBilling), true);
    expect(text(page)).toContain('INV-9001');
    expect(text(page)).toContain('\u00a325.00 outstanding');
    expect(text(page)).toContain('overdue by 28 days');
    expect(text(page)).toContain('Card expired');
    expect(text(page)).toContain('Your card has expired.');
    expect(text(page)).toContain('Visa ending 4242');
  });

  it('marks an overdue card so a run of them can be read down the page', () => {
    const page = pageFor(O.some(overdueBilling), true);
    expect(
      page.querySelector('.billing-card--overdue')
    ).not.toBeNull();
  });

  // The sequence is the point: three months paid then two missed reads very
  // differently from five missed in a row.
  it('keeps the payments made since the trouble started', () => {
    const page = pageFor(
      O.some({
        ...overdueBilling,
        invoices: [
          overdueBilling.invoices[0],
          settled({createdAt: O.some(new Date('2026-08-15T00:00:00.000Z'))}),
        ],
      }),
      true
    );
    expect(text(page)).toContain('INV-9001');
    expect(text(page)).toContain('INV-8000');
    expect(page.querySelector('.billing-card--paid')).not.toBeNull();
  });

  it('leaves the history from before the trouble to the full page', () => {
    const page = pageFor(
      O.some({
        ...overdueBilling,
        invoices: [
          overdueBilling.invoices[0],
          // Raised well before the oldest thing still owed.
          settled({createdAt: O.some(new Date('2026-01-01T00:00:00.000Z'))}),
        ],
      }),
      true
    );
    expect(text(page)).toContain('INV-9001');
    expect(text(page)).not.toContain('INV-8000');
  });

  it('shows no cards at all when nothing is outstanding', () => {
    const page = pageFor(
      O.some({
        ...overdueBilling,
        invoices: [settled()],
        totalOutstanding: 0,
        daysOverdue: O.none,
      }),
      true
    );
    expect(text(page)).toContain('Nothing outstanding.');
    expect(page.querySelectorAll('.billing-card')).toHaveLength(0);
  });

  it('links to the full history', () => {
    const page = pageFor(O.some(overdueBilling), true);
    expect(
      page.querySelector<HTMLAnchorElement>('a[href="/member/123/billing"]')!
        .textContent
    ).toContain('All invoices');
  });

  // The view model is what keeps this off other people's pages; this is the
  // belt to that braces.
  it('shows nothing at all when the viewer is not a super user', () => {
    const page = pageFor(O.none, false);
    expect(text(page)).not.toContain('Billing');
    expect(text(page)).not.toContain('INV-9001');
    expect(text(page)).not.toContain('4242');
  });

  it('shows nothing on your own page either', () => {
    const page = renderPage({...buildViewModel(false, true), billing: O.none});
    expect(text(page)).not.toContain('Billing');
    expect(text(page)).not.toContain('INV-9001');
  });

  it('says so plainly when there are no invoices against the member', () => {
    const page = pageFor(
      O.some({...overdueBilling, invoices: [], totalOutstanding: 0}),
      true
    );
    expect(text(page)).toContain('No Recurly invoices are held');
  });
});
