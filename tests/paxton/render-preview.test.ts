/**
 * @jest-environment jsdom
 */

import * as O from 'fp-ts/Option';
import {Int} from 'io-ts';
import {UUID} from 'io-ts-types';
import {faker} from '@faker-js/faker';
import {renderPreview} from '../../src/paxton/render-preview';
import {MatchResult} from '../../src/paxton/match-fobs';
import {MemberCoreInfo} from '../../src/read-models/shared-state/return-types';
import {EmailAddress, GravatarHash} from '../../src/types';

const member = (memberNumber: number, name: string): MemberCoreInfo => ({
  userId: faker.string.uuid() as UUID,
  memberNumber,
  pastMemberNumbers: [],
  primaryEmailAddress: `member-${memberNumber}@example.com` as EmailAddress,
  emails: [],
  fobs: [],
  name: O.some(name),
  formOfAddress: O.none,
  agreementSigned: O.none,
  isSuperUser: false,
  superUserSince: O.none,
  gravatarHash: 'hash' as unknown as GravatarHash,
  joined: new Date('2026-01-01T00:00:00.000Z'),
});

const render = (result: MatchResult): HTMLBodyElement => {
  const body = document.createElement('body');
  body.innerHTML = renderPreview(result);
  return body;
};

describe('fob import preview', () => {
  const molly = member(1337, 'Molly Millions');
  const row = (paxtonName: string, fobId: number) => ({
    paxtonName,
    accessLevel: '1a - Active Members',
    fobId: fobId as Int,
    addedAt: O.none,
  });

  it('carries matched rows as hidden fields and unresolved ones as an input', () => {
    const page = render({
      rows: [
        {
          row: row('Millions, Molly 1337', 1),
          outcome: {
            kind: 'matched',
            member: molly,
            how: 'number',
            nameAgrees: O.some(true),
            change: 'new',
            previousHolder: O.none,
          },
        },
        {row: row('Case, Henry', 2), outcome: {kind: 'unmatched'}},
      ],
      removals: [],
    });

    const matched = page.querySelector<HTMLInputElement>('input[name="member-1"]')!;
    expect(matched.type).toStrictEqual('hidden');
    expect(matched.value).toStrictEqual('1337');
    expect(page.querySelector<HTMLInputElement>('input[name="level-1"]')!.value).toStrictEqual('1a - Active Members');
    expect(page.querySelector<HTMLInputElement>('input[name="name-1"]')!.value).toStrictEqual('Millions, Molly 1337');

    const unresolved = page.querySelector<HTMLInputElement>('input[name="member-2"]')!;
    expect(unresolved.type).toStrictEqual('text');
    expect(unresolved.value).toStrictEqual('');
    expect(page.querySelector('form')!.getAttribute('action')).toStrictEqual('/members/import-fobs');
  });

  it('leaves unchanged fobs out of the form', () => {
    const page = render({
      rows: [
        {
          row: row('Millions, Molly 1337', 1),
          outcome: {
            kind: 'matched',
            member: molly,
            how: 'number',
            nameAgrees: O.some(true),
            change: 'unchanged',
            previousHolder: O.none,
          },
        },
      ],
      removals: [],
    });
    expect(page.querySelector('input[name="member-1"]')).toBeNull();
    expect(page.textContent).toContain('Nothing to change');
  });

  it('offers removals ticked by default with the member carried along', () => {
    const page = render({
      rows: [],
      removals: [
        {
          member: molly,
          fob: {
            fobId: 5,
            accessLevel: '1a',
            paxtonName: 'Millions, Molly',
            recordedAt: new Date('2026-01-01T00:00:00.000Z'),
          },
        },
      ],
    });
    expect(page.querySelector<HTMLInputElement>('input[name="remove-5"]')!.checked).toBe(true);
    expect(page.querySelector<HTMLInputElement>('input[name="remove-member-5"]')!.value).toStrictEqual('1337');
  });

  it('warns when a numbered name does not look like the member', () => {
    const page = render({
      rows: [
        {
          row: row('Case, Henry 1337', 1),
          outcome: {
            kind: 'matched',
            member: molly,
            how: 'number',
            nameAgrees: O.some(false),
            change: 'new',
            previousHolder: O.none,
          },
        },
      ],
      removals: [],
    });
    expect(page.textContent).toContain("name does not look like the app's");
  });
});
