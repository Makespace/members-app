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
  [
    {id: 'e1', name: 'Band Saw', areaId: 'a1'},
    // An area this member has nothing to do with, and a machine in it.
    {id: 'e2', name: 'Vinyl Cutter', areaId: 'a2'},
  ],
  [
    {id: 'a1', name: 'Wood Shop'},
    {id: 'a2', name: 'Craft Room'},
  ]
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

// A top-level group keeps its areas behind a disclosure, so they are one
// level further in than a nested row's children.
const areaListOf = (row: Element): Element | null | undefined =>
  ownPart(row, 'ns-areas')?.querySelector('.ns-children');

describe('the notification settings page', () => {
  it('saves to the settings page it came from', () => {
    const form = page().querySelector<HTMLFormElement>('form');
    expect(form?.getAttribute('method')).toBe('post');
    expect(form?.getAttribute('action')).toBe('/notification-settings');
    expect(form?.querySelector('button[type="submit"]')).not.toBeNull();
  });

  // A following row's options are disabled, so the browser sends nothing for
  // it. Without this, switching a row back to following would leave whatever
  // was stored before in place.
  it('makes a following row say so rather than say nothing', () => {
    const woodShop = rowNamed(page(), 'Wood Shop');
    const field = ownPart(woodShop, 'ns-row__controls')?.querySelector(
      '[data-ns-follow-field]'
    );
    expect(field?.getAttribute('name')).toBe('subscription:area:a1');
    expect(field?.getAttribute('value')).toBe('follow');
    expect(field?.hasAttribute('disabled')).toBe(false);
  });

  it('keeps that out of the way of a rule that speaks for itself', () => {
    const group = rowNamed(page(), "Areas I'm an owner or trainer in");
    const field = ownPart(group, 'ns-row__controls')?.querySelector(
      '[data-ns-follow-field]'
    );
    // Nothing above it to follow, so there is nothing to send.
    expect(field).toBeNull();
  });

  it('shows a rule for each level of the tree', () => {
    const labels = [...page().querySelectorAll('.ns-row__label')].map(
      el => el.textContent?.trim()
    );
    expect(labels).toContain('Tickets I reported');
    expect(labels).toContain("Areas I'm an owner or trainer in");
    expect(labels).toContain('Wood Shop');
    expect(labels).toContain('Band Saw');
    expect(labels).toContain('Other areas in Makespace');
  });

  it('nests an area inside the group it follows', () => {
    const owned = rowNamed(page(), "Areas I'm an owner or trainer in");
    expect(
      areaListOf(owned)?.querySelector('.ns-row__label')?.textContent?.trim()
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

  // The thing that makes the model reviewable: a row that follows its parent
  // still does something, and the page shows what - greyed, so it reads as
  // inherited rather than chosen.
  it('shows a following row the choice it is following', () => {
    const controls = ownPart(
      rowNamed(page(), 'Wood Shop'),
      'ns-row__controls'
    );
    const chosen = [
      ...(controls?.querySelectorAll('.ns-option input') ?? []),
    ].filter(option => option.hasAttribute('checked'));
    expect(chosen).toHaveLength(1);
    expect(chosen[0]?.getAttribute('value')).toBe('weekly');
    expect(controls?.classList.contains('ns-row__controls--following')).toBe(
      true
    );
  });

  // Following is not a kind of delivery, so it is not an option in that list.
  it('offers a switch to differ only where there is a parent to follow', () => {
    const differ = (label: string) =>
      ownPart(rowNamed(page(), label), 'ns-row__controls')?.querySelector(
        '[data-ns-differ]'
      );

    expect(differ('Tickets I reported')).toBeNull();
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
    const choice = controls?.querySelector('.ns-row__subscription');
    expect(choice).not.toBeNull();
    expect(choice?.hasAttribute('disabled')).toBe(true);
  });

  it('shows the inherited choice rather than an empty one', () => {
    const controls = ownPart(
      rowNamed(page(), 'Wood Shop'),
      'ns-row__controls'
    );
    const chosen = [
      ...(controls?.querySelectorAll('.ns-option input') ?? []),
    ].filter(option => option.hasAttribute('checked'));
    // Wood Shop follows the group, which gets a weekly summary.
    expect(chosen).toHaveLength(1);
    expect(chosen[0]?.getAttribute('value')).toBe('weekly');
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
      controls?.querySelector('.ns-row__subscription')?.hasAttribute('disabled')
    ).toBe(false);
  });

  // One choice rather than five boxes: nobody has a view on parked versus
  // picked up.
  // One question per rule: how often somebody hears and how much they hear
  // were the same question wearing two controls.
  it('asks one question per rule, with four answers', () => {
    const owned = rowNamed(page(), "Areas I'm an owner or trainer in");
    const controls = ownPart(owned, 'ns-row__controls');
    const options = controls?.querySelectorAll('.ns-option input');
    expect(options?.length).toBe(4);
    options?.forEach(option =>
      expect(option.getAttribute('type')).toBe('radio')
    );
    expect(controls?.querySelectorAll('select')).toHaveLength(0);
  });

  it('names each answer', () => {
    const owned = rowNamed(page(), "Areas I'm an owner or trainer in");
    const shown = ownPart(owned, 'ns-row__controls')?.textContent ?? '';
    expect(shown).toContain('Live feed');
    expect(shown).toContain('Daily summary');
    expect(shown).toContain('Weekly summary');
    expect(shown).toContain('No notifications');
  });

  // A title for each of the three, subtitles for what sits inside them.
  it('ranks the rules by heading level', () => {
    const level = (label: string) =>
      ownPart(rowNamed(page(), label), 'ns-row__head')?.querySelector(
        '.ns-row__label'
      )?.tagName;
    expect(level('Tickets I reported')).toBe('H2');
    expect(level('Wood Shop')).toBe('H3');
    expect(level('Band Saw')).toBe('H4');
  });

  it('asks the same question about the tickets somebody reported', () => {
    const mine = rowNamed(page(), 'Tickets I reported');
    const controls = ownPart(mine, 'ns-row__controls');
    expect(controls?.querySelectorAll('.ns-option input')).toHaveLength(4);
  });

  // Some areas hold a dozen machines, and most of them follow the area, so
  // listing them all says nothing.
  it('folds away a machine that simply follows its area', () => {
    const cutter = rowNamed(page(), 'Vinyl Cutter');

    expect(cutter.classList.contains('ns-row--folded')).toBe(true);
  });

  // The setting somebody would most want to see is the one that is not the
  // default, and being made a trainer on a machine creates exactly that
  // inside an area that still follows the group. Folding the area away would
  // make it the one setting they could not reach.
  it('keeps a machine set differently visible, though its area follows the group', () => {
    const woodShop = rowNamed(page(), 'Wood Shop');
    const bandSaw = rowNamed(page(), 'Band Saw');

    expect(
      ownPart(woodShop, 'ns-row__controls')?.classList.contains(
        'ns-row__controls--following'
      )
    ).toBe(true);
    expect(bandSaw.classList.contains('ns-row--folded')).toBe(false);
  });

  it('says how many machines it folded away, so they can be found', () => {
    const craftRoom = rowNamed(page(), 'Craft Room');

    expect(
      ownPart(craftRoom, 'ns-row__folded')?.textContent?.replace(/\s+/g, ' ')
    ).toContain('1 machine here follows this');
  });

  // An area whose machines all follow it has nothing worth announcing.
  it('says nothing about folded machines when none are set differently', () => {
    const woodShop = rowNamed(page(), 'Wood Shop');

    expect(ownPart(woodShop, 'ns-row__folded')).toBeUndefined();
  });

  // A shut disclosure would hide it otherwise, and somebody looking for the
  // odd one out has no way of knowing which area to open.
  it('says on the disclosure how many areas hold something set differently', () => {
    const summary = ownPart(
      rowNamed(page(), "Areas I'm an owner or trainer in"),
      'ns-areas'
    )?.querySelector('summary');

    expect(summary?.textContent?.replace(/\s+/g, ' ')).toContain(
      '1 set differently'
    );
  });

  // Somebody's own areas double as a way round their own patch, so that list
  // starts open; every other area in the building does not.
  it('opens the areas somebody is responsible for and shuts the rest', () => {
    const mine = ownPart(
      rowNamed(page(), "Areas I'm an owner or trainer in"),
      'ns-areas'
    );
    const others = ownPart(
      rowNamed(page(), 'Other areas in Makespace'),
      'ns-areas'
    );
    expect(mine?.hasAttribute('open')).toBe(true);
    expect(others?.hasAttribute('open')).toBe(false);
  });

  it('says how many areas are behind each disclosure', () => {
    const summary = ownPart(
      rowNamed(page(), 'Other areas in Makespace'),
      'ns-areas'
    )?.querySelector('summary');
    expect(summary?.textContent?.replace(/\s+/g, ' ')).toContain(
      'View specific areas (1)'
    );
  });

  it('leads with how many rules actually send something', () => {
    expect(text(page())).toContain('5 of these currently send you something');
  });

  it('explains the empty tree to somebody who owns nothing', () => {
    const model = {...viewModel, isOwner: false, isTrainer: false};
    expect(text(page(model))).toContain('do not own an area');
  });
});
