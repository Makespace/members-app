/**
 * @jest-environment jsdom
 */

import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {UUID} from 'io-ts-types';
import {render} from '../../../src/queries/members/render';
import {ViewModel} from '../../../src/queries/members/view-model';
import {EmailAddress, GravatarHash} from '../../../src/types';

const member = (
  memberNumber: number,
  recurlyStatus: 'active' | 'inactive'
): ViewModel['members'][number] => ({
  userId: faker.string.uuid() as UUID,
  memberNumber,
  pastMemberNumbers: [],
  primaryEmailAddress: `member-${memberNumber}@example.com` as EmailAddress,
  emails: [],
  fobs: [],
  name: O.none,
  formOfAddress: O.none,
  ownerAgreement: O.none,
  isSuperUser: false,
  superUserSince: O.none,
  gravatarHash: 'hash' as unknown as GravatarHash,
  joined: new Date('2026-01-01T00:00:00.000Z'),
  recurlyStatus,
});

// The primary table is the only one not inside the inactive members' <details>.
const primaryTable = (body: HTMLElement) =>
  Array.from(body.querySelectorAll('table')).find(
    table => table.closest('details') === null
  );

const rows = (container: Element) =>
  Array.from(container.querySelectorAll('tbody tr')).map(row => ({
    memberNumber: row.querySelector('td:nth-child(2)')!.textContent.trim(),
    status: row.querySelector('.tag')!.textContent,
  }));

describe('members render', () => {
  it('shows active members in the primary table and inactive members in a collapsible section', () => {
    const body = document.createElement('body');
    body.innerHTML = render({
      members: [member(1, 'inactive'), member(2, 'active')],
    });

    expect(body.querySelector('h2')!.textContent).toContain(
      'Active members (1)'
    );
    expect(rows(primaryTable(body)!)).toStrictEqual([
      {memberNumber: '2', status: 'active'},
    ]);

    const details = body.querySelector('details')!;
    expect(details.querySelector('summary')!.textContent).toContain(
      'Inactive members (1)'
    );
    expect(rows(details.querySelector('table')!)).toStrictEqual([
      {memberNumber: '1', status: 'inactive'},
    ]);
  });

  it('sorts each section by member number', () => {
    const body = document.createElement('body');
    body.innerHTML = render({
      members: [
        member(5, 'active'),
        member(2, 'inactive'),
        member(3, 'active'),
        member(1, 'inactive'),
      ],
    });

    expect(
      rows(primaryTable(body)!).map(row => row.memberNumber)
    ).toStrictEqual(['3', '5']);
    expect(
      rows(body.querySelector('details table')!).map(row => row.memberNumber)
    ).toStrictEqual(['1', '2']);
  });

  it('omits the inactive section when every member is active', () => {
    const body = document.createElement('body');
    body.innerHTML = render({
      members: [member(1, 'active'), member(2, 'active')],
    });

    expect(body.querySelector('details')).toBeNull();
    expect(
      rows(primaryTable(body)!).map(row => row.memberNumber)
    ).toStrictEqual(['1', '2']);
  });

  it('shows a hint when no members are active', () => {
    const body = document.createElement('body');
    body.innerHTML = render({
      members: [member(1, 'inactive'), member(2, 'inactive')],
    });

    expect(primaryTable(body)).toBeUndefined();
    expect(body.textContent).toContain(
      'No active members — see inactive members below.'
    );
    expect(body.querySelector('details summary')!.textContent).toContain(
      'Inactive members (2)'
    );
  });

  it('shows a placeholder when there are no members', () => {
    const body = document.createElement('body');
    body.innerHTML = render({members: []});

    expect(body.textContent).toContain('Currently no members');
    expect(primaryTable(body)).toBeUndefined();
    expect(body.querySelector('details')).toBeNull();
  });
});
