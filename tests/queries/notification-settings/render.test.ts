/**
 * @jest-environment jsdom
 */

import {UUID} from 'io-ts-types';
import {render} from '../../../src/queries/notification-settings/render';
import {preferencesFor} from '../../../src/trouble-tickets/notification-preferences';
import {ViewModel} from '../../../src/queries/notification-settings/view-model';

const scopes = preferencesFor({
  ownerOf: [
    {id: 'a1', name: 'Wood Shop', ownershipRecordedAt: new Date()},
  ],
  trainerFor: [
    {
      equipment_id: 'e1' as UUID,
      equipment_name: 'Laser Cutter',
      since: new Date(),
    },
  ],
});

const viewModel: ViewModel = {
  scopes,
  soundingCount: 5,
  isOwner: true,
  isTrainer: true,
};

const page = (model: ViewModel = viewModel) => {
  const body = document.createElement('body');
  body.innerHTML = render(model);
  return body;
};

const text = (el: HTMLElement) =>
  (el.textContent ?? '').replace(/\s+/g, ' ').trim();

// A row contains its children's rows, and this jsdom does not honour ":scope >"
// in an element-rooted query - it matches descendants regardless. So the row's
// own parts are found by walking its direct children.
const rowNamed = (body: HTMLElement, label: string): Element => {
  const found = [...body.querySelectorAll('.ns-row')].find(row =>
    [...row.children].some(
      child =>
        child.classList.contains('ns-row__head') &&
        child.querySelector('.ns-row__label')?.textContent?.trim() === label
    )
  );
  if (found === undefined) {
    throw new Error(`no row labelled ${label}`);
  }
  return found;
};

const ownPart = (row: Element, className: string): Element | undefined =>
  [...row.children].find(child => child.classList.contains(className));

describe('the notification settings page', () => {
  // Honesty while this is a preview: somebody who changes a dropdown and
  // walks away must not think they have changed anything.
  it('says plainly that nothing is saved yet', () => {
    expect(text(page())).toContain('Nothing you choose here is saved yet');
  });

  it('shows a rule for each level of the tree', () => {
    const labels = [...page().querySelectorAll('.ns-row__label')].map(
      el => el.textContent?.trim()
    );
    expect(labels).toContain('Tickets I reported');
    expect(labels).toContain('Areas I own');
    expect(labels).toContain('Wood Shop');
    expect(labels).toContain('Equipment I train on');
    expect(labels).toContain('Laser Cutter');
    expect(labels).toContain('Anywhere else in Makespace');
  });

  it('nests a machine inside the group it follows', () => {
    const owned = rowNamed(page(), 'Areas I own');
    expect(
      ownPart(owned, 'ns-children')?.querySelector('.ns-row__label')
        ?.textContent?.trim()
    ).toBe('Wood Shop');
  });

  // The thing that makes the model reviewable: a row that follows its parent
  // still does something, and the page says what.
  it('says what each rule comes to, not only what it says', () => {
    const woodShop = rowNamed(page(), 'Wood Shop');
    expect(
      ownPart(woodShop, 'ns-row__head')?.querySelector('.ns-row__effect')
        ?.textContent
    ).toContain('reported');
  });

  it('offers following the parent only where there is a parent to follow', () => {
    const options = (label: string) =>
      [
        ...(ownPart(rowNamed(page(), label), 'ns-row__controls')?.querySelectorAll(
          'select option'
        ) ?? []),
      ].map(option => option.getAttribute('value'));

    expect(options('Everything else')).not.toContain('inherit');
    expect(options('Wood Shop')).toContain('inherit');
  });

  // Ticking what to hear about makes no sense while following somebody else.
  it('does not offer happenings to a rule that follows its parent', () => {
    const woodShop = rowNamed(page(), 'Wood Shop');
    expect(
      ownPart(woodShop, 'ns-row__controls')?.querySelector('.ns-row__happenings')
    ).toBeNull();
  });

  it('offers every happening to a rule that speaks for itself', () => {
    const owned = rowNamed(page(), 'Areas I own');
    const boxes = ownPart(owned, 'ns-row__controls')?.querySelectorAll(
      '.ns-check input'
    );
    expect(boxes?.length).toBe(5);
  });

  it('leads with how many rules actually send something', () => {
    expect(text(page())).toContain('5 of these currently send you something');
  });

  it('explains the empty tree to somebody who owns nothing', () => {
    const model = {...viewModel, isOwner: false, isTrainer: false};
    expect(text(page(model))).toContain('do not own an area');
  });
});
