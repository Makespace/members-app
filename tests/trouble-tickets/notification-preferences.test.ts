import * as O from 'fp-ts/Option';
import {UUID} from 'io-ts-types';
import {
  allScopes,
  preferencesFor,
  ScopeNode,
  soundingScopes,
} from '../../src/trouble-tickets/notification-preferences';

const WOOD = 'a-wood';
const METAL = 'a-metal';
const LASER = 'e-laser';
const BANDSAW = 'e-bandsaw';

const areas = [
  {id: WOOD, name: 'Wood Shop'},
  {id: METAL, name: 'Metal Shop'},
];

const equipment = [
  {id: BANDSAW, name: 'Band Saw', areaId: WOOD},
  {id: LASER, name: 'Laser Cutter', areaId: METAL},
];

const owns = (id: string, name: string) => ({
  id,
  name,
  ownershipRecordedAt: new Date('2026-01-01T00:00:00.000Z'),
});

const trains = (id: string, name: string) => ({
  equipment_id: id as UUID,
  equipment_name: name,
  since: new Date('2026-01-01T00:00:00.000Z'),
});

const find = (scopes: ReadonlyArray<ScopeNode>, id: string): ScopeNode => {
  const found = allScopes(scopes).find(scope => scope.id === id);
  if (found === undefined) {
    throw new Error(`no scope ${id}`);
  }
  return found;
};

const myAreasOf = (scopes: ReadonlyArray<ScopeNode>) =>
  find(scopes, 'my-areas').children.map(child => child.label);

describe('which areas somebody gets a rule for', () => {
  it('lists an area they own', () => {
    const scopes = preferencesFor(
      {ownerOf: [owns(WOOD, 'Wood Shop')], trainerFor: []},
      equipment,
      areas
    );
    expect(myAreasOf(scopes)).toEqual(['Wood Shop']);
  });

  // The reason the group is no longer called "areas I own": somebody who
  // trains in an area wants to hear about it whether or not they own it.
  it('lists an area they only train in', () => {
    const scopes = preferencesFor(
      {ownerOf: [], trainerFor: [trains(LASER, 'Laser Cutter')]},
      equipment,
      areas
    );
    expect(myAreasOf(scopes)).toEqual(['Metal Shop']);
  });

  it('lists an area once when they both own it and train in it', () => {
    const scopes = preferencesFor(
      {
        ownerOf: [owns(WOOD, 'Wood Shop')],
        trainerFor: [trains(BANDSAW, 'Band Saw')],
      },
      equipment,
      areas
    );
    expect(myAreasOf(scopes)).toEqual(['Wood Shop']);
  });

  it('sorts them by name', () => {
    const scopes = preferencesFor(
      {
        ownerOf: [owns(WOOD, 'Wood Shop')],
        trainerFor: [trains(LASER, 'Laser Cutter')],
      },
      equipment,
      areas
    );
    expect(myAreasOf(scopes)).toEqual(['Metal Shop', 'Wood Shop']);
  });

  // A row that cannot say why it is there is harder to trust.
  it.each([
    [[owns(WOOD, 'Wood Shop')], [], 'owner'],
    [[], [trains(BANDSAW, 'Band Saw')], 'trainer'],
    [
      [owns(WOOD, 'Wood Shop')],
      [trains(BANDSAW, 'Band Saw')],
      'owner and trainer',
    ],
  ])('says why the area is listed: %#', (ownerOf, trainerFor, expected) => {
    const scopes = preferencesFor({ownerOf, trainerFor}, equipment, areas);
    expect(find(scopes, `area:${WOOD}`).note).toStrictEqual(O.some(expected));
  });
});

describe('the machines inside an area', () => {
  const member = {
    ownerOf: [owns(WOOD, 'Wood Shop')],
    trainerFor: [trains(BANDSAW, 'Band Saw'), trains(LASER, 'Laser Cutter')],
  };

  it('puts a machine under the area it actually sits in', () => {
    const scopes = preferencesFor(member, equipment, areas);
    expect(
      find(scopes, `area:${WOOD}`).children.map(child => child.label)
    ).toEqual(['Band Saw']);
    expect(
      find(scopes, `area:${METAL}`).children.map(child => child.label)
    ).toEqual(['Laser Cutter']);
  });

  it('follows its own area rather than the group above it', () => {
    const scopes = preferencesFor(member, equipment, areas);
    expect(find(scopes, `equipment:${BANDSAW}`).inheritsFrom).toStrictEqual(
      O.some('Wood Shop')
    );
  });

  it('takes the area rule when it says nothing of its own', () => {
    const scopes = preferencesFor(member, equipment, areas);
    expect(find(scopes, `equipment:${BANDSAW}`).effective).toStrictEqual(
      find(scopes, `area:${WOOD}`).effective
    );
  });

  it('leaves out a machine whose area is unknown', () => {
    const scopes = preferencesFor(
      {ownerOf: [], trainerFor: [trains('e-ghost', 'Ghost Machine')]},
      equipment,
      areas
    );
    expect(myAreasOf(scopes)).toEqual([]);
  });
});

describe('what somebody hears by default', () => {
  const member = {
    ownerOf: [owns(WOOD, 'Wood Shop')],
    trainerFor: [trains(LASER, 'Laser Cutter')],
  };

  // The gap this whole feature exists to close: today an owner is told
  // nothing when a ticket is raised in their area.
  it('tells them when something in one of their areas is reported', () => {
    const scopes = preferencesFor(member, equipment, areas);
    const mine = find(scopes, 'my-areas');
    expect(mine.effective.delivery).toBe('as-it-happens');
    expect(mine.effective.happenings).toContain('reported');
  });

  it('stays quiet about everything they are not responsible for', () => {
    const scopes = preferencesFor(member, equipment, areas);
    expect(find(scopes, 'everything').effective.delivery).toBe('never');
    expect(find(scopes, 'everywhere-else').effective.delivery).toBe('never');
  });

  it('always tells them about a ticket they reported themselves', () => {
    const mine = find(preferencesFor(member, equipment, areas), 'reported-by-me');
    expect(mine.effective.happenings).toEqual([
      'picked-up',
      'needs-help',
      'parked',
      'resolved',
    ]);
  });

  it('counts only the rules that actually send something', () => {
    const sounding = soundingScopes(
      preferencesFor(member, equipment, areas)
    ).map(scope => scope.id);
    expect(sounding).toContain('reported-by-me');
    expect(sounding).toContain('my-areas');
    expect(sounding).toContain(`area:${WOOD}`);
    expect(sounding).not.toContain('everything');
    expect(sounding).not.toContain('everywhere-else');
  });

  it('still gives somebody with no areas the rules that apply to them', () => {
    const scopes = preferencesFor({ownerOf: [], trainerFor: []}, [], []);
    expect(find(scopes, 'my-areas').children).toEqual([]);
    expect(find(scopes, 'reported-by-me').effective.delivery).toBe(
      'as-it-happens'
    );
  });

  // Somebody's own areas are named on their member record, so the list still
  // works if nothing else is passed in.
  it('names an owned area without being told about every area', () => {
    const scopes = preferencesFor(
      {ownerOf: [owns(WOOD, 'Wood Shop')], trainerFor: []},
      [],
      []
    );
    expect(myAreasOf(scopes)).toEqual(['Wood Shop']);
  });
});
