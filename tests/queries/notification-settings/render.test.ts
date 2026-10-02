/**
 * @jest-environment jsdom
 */

import {UUID} from 'io-ts-types';
import {render} from '../../../src/queries/notification-settings/render';
import {preferencesFor} from '../../../src/trouble-tickets/notification-preferences';
import {ViewModel} from '../../../src/queries/notification-settings/view-model';

const scopes = preferencesFor(
  {
    ownerOf: [{id: 'a1', name: 'Wood Shop', ownershipRecordedAt: new Date()}],
    trainerFor: [
      {
        equipment_id: 'e1' as UUID,
        equipment_name: 'Band Saw',
        since: new Date(),
      },
    ],
  },
  [{id: 'e1', name: 'Band Saw', areaId: 'a1'}],
  [{id: 'a1', name: 'Wood Shop'}]
);

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
    expect(labels).toContain("Areas I'm an owner or trainer in");
    expect(labels).toContain('Wood Shop');
    expect(labels).toContain('Band Saw');
    expect(labels).toContain('Anywhere else in Makespace');
  });

  it('nests a machine inside the group it follows', () => {
    const owned = rowNamed(page(), "Areas I'm an owner or trainer in");
    expect(
      ownPart(owned, 'ns-children')?.querySelector('.ns-row__label')
        ?.textContent?.trim()
    ).toBe('Wood Shop');
  });

  // A machine sits under the area it is in, not under a group of its own.
  it('nests a machine inside its own area', () => {
    const woodShop = rowNamed(page(), 'Wood Shop');
    expect(
      ownPart(woodShop, 'ns-children')?.querySelector('.ns-row__label')
        ?.textContent?.trim()
    ).toBe('Band Saw');
  });

  it('says why an area is in the list', () => {
    const woodShop = rowNamed(page(), 'Wood Shop');
    expect(
      ownPart(woodShop, 'ns-row__head')?.querySelector('.ns-row__why')
        ?.textContent?.trim()
    ).toBe('owner and trainer');
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

  // Following is not a kind of delivery, so it is not an option in that list.
  it('offers a switch to differ only where there is a parent to follow', () => {
    const differ = (label: string) =>
      ownPart(rowNamed(page(), label), 'ns-row__controls')?.querySelector(
        '[data-ns-differ]'
      );

    expect(differ('Everything else')).toBeNull();
    expect(differ('Wood Shop')).not.toBeNull();
  });

  it('names the rule a row would be differing from', () => {
    const controls = ownPart(
      rowNamed(page(), 'Wood Shop'),
      'ns-row__controls'
    );
    expect(controls?.querySelector('.ns-row__differ')?.textContent).toContain(
      "Areas I'm an owner or trainer in"
    );
  });

  // Ticking what to hear about makes no sense while following somebody else.
  // Greyed rather than hidden: somebody deciding whether to differ wants to
  // see what they would be differing from.
  it('shows a following row the settings it is following, turned off', () => {
    const controls = ownPart(
      rowNamed(page(), 'Wood Shop'),
      'ns-row__controls'
    );
    expect(controls?.classList.contains('ns-row__controls--following')).toBe(
      true
    );
    const happenings = controls?.querySelector('.ns-row__happenings');
    expect(happenings).not.toBeNull();
    expect(happenings?.hasAttribute('disabled')).toBe(true);
    expect(
      controls?.querySelector('.ns-row__delivery')?.hasAttribute('disabled')
    ).toBe(true);
  });

  it('shows the inherited values rather than empty boxes', () => {
    const controls = ownPart(
      rowNamed(page(), 'Wood Shop'),
      'ns-row__controls'
    );
    const ticked = [
      ...(controls?.querySelectorAll('.ns-check input') ?? []),
    ].filter(box => box.hasAttribute('checked'));
    // Wood Shop follows the group, which hears about reported and needs-help.
    expect(ticked).toHaveLength(2);
  });

  it('leaves a rule that speaks for itself switched on', () => {
    const controls = ownPart(
      rowNamed(page(), "Areas I'm an owner or trainer in"),
      'ns-row__controls'
    );
    expect(controls?.classList.contains('ns-row__controls--following')).toBe(
      false
    );
    expect(
      controls?.querySelector('.ns-row__happenings')?.hasAttribute('disabled')
    ).toBe(false);
  });

  it('offers every happening to a rule that speaks for itself', () => {
    const owned = rowNamed(page(), "Areas I'm an owner or trainer in");
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
