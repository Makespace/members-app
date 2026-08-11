/**
 * @jest-environment jsdom
 */

import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {UUID} from 'io-ts-types';
import {Area, Equipment} from '../../src/read-models/shared-state/return-types';
import {navBar, navBarViewModel} from '../../src/templates/navbar';
import {EmailAddress} from '../../src/types';
import {User} from '../../src/types/user';

const renderNav = (isSuperUser: boolean, areas: ReadonlyArray<Area>) => {
  const rendered = navBar(
    {
      emailAddress: faker.internet.email() as EmailAddress,
      memberNumber: faker.number.int({min: 1}),
    } as User,
    isSuperUser,
    navBarViewModel(areas)
  );
  const body = document.createElement('body');
  body.innerHTML = rendered;
  return body;
};

const makeEquipment = (name: string, removed = false): Equipment => ({
  id: faker.string.uuid() as UUID,
  name,
  trainers: [],
  trainedMembers: [],
  trainingSheetId: O.none,
  removedAt: removed ? O.some(new Date('2026-01-01T00:00:00.000Z')) : O.none,
  area: {
    id: faker.string.uuid() as UUID,
    name: 'Parent area',
    email: O.none,
  },
});

const areaOneId = faker.string.uuid() as UUID;
const areaTwoId = faker.string.uuid() as UUID;
const emptyAreaId = faker.string.uuid() as UUID;

const areas: ReadonlyArray<Area> = [
  {
    id: areaTwoId,
    name: 'Wood',
    email: O.none,
    owners: [],
    equipment: [makeEquipment('Bandsaw'), makeEquipment('Table Saw', true)],
  },
  {
    id: areaOneId,
    name: 'Electronics',
    email: O.none,
    owners: [],
    equipment: [makeEquipment('Oscilloscope'), makeEquipment('Soldering Station')],
  },
];

describe('navBar', () => {
  it('renders the new primary navigation structure', () => {
    const page = renderNav(false, areas);

    expect(page.textContent).toContain('Areas & tools');
    expect(page.textContent).toContain('Raise an issue');
    expect(page.textContent).toContain('Community');
    expect(page.textContent).toContain('All areas');
    expect(page.textContent).not.toContain('Log out');
  });

  it('renders admin only for super users', () => {
    expect(renderNav(false, areas).textContent).not.toContain('Admin');
    expect(renderNav(true, areas).textContent).toContain('Admin');
  });

  it('requests a simple profile image when no custom Gravatar exists', () => {
    const page = renderNav(false, areas);
    const profileLink = page.querySelector('.page-nav__profile-link');
    const avatar = page.querySelector('.page-nav__profile-avatar');

    expect(profileLink?.getAttribute('aria-label')).toStrictEqual('Your profile');
    expect(avatar?.getAttribute('src')).toContain('&d=mp');
  });

  it('renders tool drilldown links to equipment pages', () => {
    const page = renderNav(false, areas);
    const links = [...page.querySelectorAll('.page-nav__tool-list a')].map(link =>
      link.getAttribute('href')
    );

    expect(links.some(link => link?.startsWith('/equipment/'))).toBeTruthy();
  });

  it('links each tool panel and desktop area button to its area', () => {
    const page = renderNav(false, areas);
    const areaLink = page.querySelector(
      `.page-nav__tools-panel[data-area-id="${areaOneId}"] .page-nav__all-areas-link`
    );
    const areaButton = page.querySelector(
      `.page-nav__area-button[data-area-id="${areaOneId}"]`
    );

    expect(areaLink?.getAttribute('href')).toStrictEqual(
      `/areas#area-${areaOneId}`
    );
    expect(areaLink?.textContent?.trim()).toStrictEqual('View area');
    expect(areaButton?.getAttribute('data-area-href')).toStrictEqual(
      `/areas#area-${areaOneId}`
    );
  });

  it('includes hidden future search and equipment catalogue stubs', () => {
    const page = renderNav(false, areas);

    expect(page.querySelector('.page-nav__future-search')).not.toBeNull();
    expect(page.querySelector('.page-nav__future-catalogue')).not.toBeNull();
    expect(
      page.querySelector('.page-nav__future-catalogue')?.getAttribute('href')
    ).toStrictEqual('/equipment-catalogue');
  });

  it('orders external links by the requested priority', () => {
    const page = renderNav(false, areas);
    const links = [...page.querySelectorAll('.page-nav__site-link')].map(link =>
      link.textContent?.trim()
    );

    expect(links).toStrictEqual([
      'Equipment website',
      'Makespace website',
      'Meetup',
      'Discord',
      'Google Groups',
    ]);
  });

  it('filters removed equipment and sorts areas alphabetically', () => {
    const page = renderNav(false, areas);
    const areaButtons = [...page.querySelectorAll('.page-nav__area-button')].map(
      button => button.textContent?.trim()
    );

    expect(areaButtons).toStrictEqual(['Electronics', 'Wood']);
    expect(page.textContent).toContain('Bandsaw');
    expect(page.textContent).not.toContain('Table Saw');
  });

  it('lists areas without tools as links after the area buttons', () => {
    const emptyArea: Area = {
      id: emptyAreaId,
      name: 'Quiet Room',
      email: O.none,
      owners: [],
      equipment: [],
    };
    const page = renderNav(false, [emptyArea, ...areas]);
    const areaListItems = [
      ...page.querySelector('.page-nav__area-list')!.children,
    ];
    const emptyAreaLink = page.querySelector('.page-nav__area-link--empty');

    expect(areaListItems.at(-1)?.classList).toContain(
      'page-nav__empty-area-list'
    );
    expect(emptyAreaLink?.textContent?.trim()).toStrictEqual('Quiet Room');
    expect(emptyAreaLink?.getAttribute('href')).toStrictEqual(
      `/areas#area-${emptyAreaId}`
    );
    expect(
      page.querySelector(`.page-nav__area-button[data-area-id="${emptyAreaId}"]`)
    ).toBeNull();
  });
});
