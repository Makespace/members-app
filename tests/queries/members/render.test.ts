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
  name: O.none,
  formOfAddress: O.none,
  agreementSigned: O.none,
  isSuperUser: false,
  superUserSince: O.none,
  gravatarHash: 'hash' as unknown as GravatarHash,
  joined: new Date('2026-01-01T00:00:00.000Z'),
  recurlyStatus,
});

describe('members render', () => {
  it('shows each member recurly status', () => {
    const body = document.createElement('body');
    body.innerHTML = render({
      members: [
        member(2, 'active'),
        member(1, 'inactive'),
      ],
    });

    expect(
      Array.from(body.querySelectorAll('tbody tr')).map(row => ({
        memberNumber: row.querySelector('td:nth-child(2)')!.textContent.trim(),
        status: row.querySelector('.tag')!.textContent,
      }))
    ).toStrictEqual([
      {memberNumber: '1', status: 'inactive'},
      {memberNumber: '2', status: 'active'},
    ]);
  });
});
