/**
 * @jest-environment jsdom
 */

import * as O from 'fp-ts/Option';
import {UUID} from 'io-ts-types';
import {render} from '../../../src/queries/access-audit/render';
import {AuditRow} from '../../../src/queries/access-audit/classify';
import {ViewModel} from '../../../src/queries/access-audit/view-model';
import {EmailAddress, GravatarHash} from '../../../src/types';

const row = (
  memberNumber: number,
  name: string,
  levels: ReadonlyArray<string>,
  entitlement: AuditRow['entitlement']
): AuditRow => ({
  member: {
    userId: `u${memberNumber}` as UUID,
    memberNumber,
    pastMemberNumbers: [],
    primaryEmailAddress: 'x@example.com' as EmailAddress,
    emails: [],
    fobs: levels.map((accessLevel, i) => ({
      fobId: 100 + i,
      accessLevel,
      paxtonName: 'x',
      recordedAt: new Date('2026-01-01T00:00:00.000Z'),
    })),
    name: O.some(name),
    formOfAddress: O.none,
    agreementSigned: O.none,
    isSuperUser: false,
    superUserSince: O.none,
    gravatarHash: 'hash' as unknown as GravatarHash,
    joined: new Date('2026-01-01T00:00:00.000Z'),
  },
  fobAccess: levels.length === 0 ? 'none' : 'live',
  entitlement,
});

const viewModel = (overrides: Partial<ViewModel> = {}): ViewModel => ({
  groups: {toRevoke: [], toReinstate: [], noFob: [], pausedOnPurpose: [], consistent: 5},
  totalMembers: 5,
  membersWithFobs: 5,
  thresholds: {removeAccessAfterDays: 14, cancelAfterDays: 60},
  ...overrides,
});

const page = (vm: ViewModel) => {
  const body = document.createElement('body');
  body.innerHTML = render(vm);
  return body;
};

describe('door access audit page', () => {
  it('names the threshold and the consistent count', () => {
    const text = page(viewModel()).textContent;
    expect(text).toContain('14 or more days');
    expect(text).toContain('5 of 5');
  });

  it('points at the import when no fobs are known', () => {
    const rendered = page(viewModel({membersWithFobs: 0}));
    expect(rendered.querySelector('a[href="/members/import-fobs"]')).not.toBeNull();
  });

  it('does not nag about the import once fobs exist', () => {
    expect(page(viewModel()).textContent).not.toContain('No fobs have been imported');
  });

  it('shows each person with why, their fobs, and a link to their page', () => {
    const rendered = page(
      viewModel({
        groups: {
          toRevoke: [
            row(42, 'Molly Millions', ['1a - Active Members'], {
              kind: 'not-entitled',
              why: 'overdue',
              daysOverdue: O.some(21),
            }),
          ],
          toReinstate: [],
          noFob: [row(7, 'Henry Case', [], {kind: 'entitled'})],
          pausedOnPurpose: [],
          consistent: 0,
        },
      })
    );
    expect(rendered.querySelector('a[href="/member/42/"]')).not.toBeNull();
    expect(rendered.textContent).toContain('Molly Millions');
    expect(rendered.textContent).toContain('21 days overdue');
    expect(rendered.textContent).toContain('100');
    expect(rendered.textContent).toContain('Henry Case');
    expect(rendered.textContent).toContain('none recorded');
  });
});
