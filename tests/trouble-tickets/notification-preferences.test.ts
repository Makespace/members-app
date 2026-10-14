import * as O from 'fp-ts/Option';
import {UUID} from 'io-ts-types';
import {
  allScopes,
  happeningsOf,
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

const PLANER = 'e-planer';

const equipment = [
  {id: BANDSAW, name: 'Band Saw', areaId: WOOD},
  {id: PLANER, name: 'Planer', areaId: WOOD},
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
    ).toEqual(['Band Saw', 'Planer']);
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
    expect(find(scopes, `equipment:${PLANER}`).setting.kind).toBe('inherit');
    expect(find(scopes, `equipment:${PLANER}`).effective).toStrictEqual(
      find(scopes, `area:${WOOD}`).effective
    );
  });

  // A machine somebody is named on is their job in a way the rest of the area
  // is not, so it is heard about sooner than the area around it.
  it('hears about a machine they are named on sooner than its area', () => {
    const scopes = preferencesFor(member, equipment, areas);
    expect(find(scopes, `area:${WOOD}`).effective).toBe('weekly');
    expect(find(scopes, `equipment:${BANDSAW}`).effective).toBe('daily');
    expect(find(scopes, `equipment:${PLANER}`).effective).toBe('weekly');
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

describe('areas somebody has nothing to do with', () => {
  const member = {
    ownerOf: [owns(WOOD, 'Wood Shop')],
    trainerFor: [],
  };

  const otherAreasOf = (scopes: ReadonlyArray<ScopeNode>) =>
    find(scopes, 'other-areas').children.map(child => child.label);

  it('lists every area they are not in', () => {
    expect(otherAreasOf(preferencesFor(member, equipment, areas))).toEqual([
      'Metal Shop',
    ]);
  });

  it('does not list an area twice', () => {
    const scopes = preferencesFor(member, equipment, areas);
    expect(myAreasOf(scopes)).toEqual(['Wood Shop']);
    expect(otherAreasOf(scopes)).not.toContain('Wood Shop');
  });

  // The point of listing them: picking out one machine somewhere you have
  // nothing to do with, which the hierarchy was always meant to allow.
  it('carries the machines in those areas', () => {
    const scopes = preferencesFor(member, equipment, areas);
    expect(find(scopes, `area:${METAL}`).children.map(c => c.label)).toEqual([
      'Laser Cutter',
    ]);
  });

  // An owner wanting to mute one noisy machine should not have to be its
  // trainer first.
  it('lists every machine in an area, not only the ones they train on', () => {
    const scopes = preferencesFor(member, equipment, areas);
    expect(find(scopes, `area:${WOOD}`).children.map(c => c.label)).toEqual([
      'Band Saw',
      'Planer',
    ]);
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
    expect(mine.effective).toBe('weekly');
    expect(happeningsOf(mine.effective)).toContain('reported');
  });

  it('stays quiet about areas they have nothing to do with', () => {
    const scopes = preferencesFor(member, equipment, areas);
    expect(find(scopes, 'other-areas').effective).toBe('none');
  });

  // Three things side by side, with nothing above them: a parent whose only
  // job was to be inherited from was a level to read past.
  it('puts the three things somebody can be told about side by side', () => {
    const scopes = preferencesFor(member, equipment, areas);
    expect(scopes.map(scope => scope.id)).toEqual([
      'reported-by-me',
      'my-areas',
      'other-areas',
    ]);
    scopes.forEach(scope => expect(scope.inheritsFrom).toStrictEqual(O.none));
  });

  // Your own ticket is the exception: you know it was reported, so what is
  // left to tell you is what became of it, whatever the interest says.
  // Including that it was reported: the email that goes out then says "we
  // have logged your report", which is the most useful one they get.
  it('always tells them what became of a ticket they reported', () => {
    const mine = find(
      preferencesFor(member, equipment, areas),
      'reported-by-me'
    );
    expect(happeningsOf(mine.effective)).toEqual([
      'reported',
      'picked-up',
      'needs-help',
      'parked',
      'resolved',
    ]);
  });

  // Summaries cover the same events as the live feed; they only arrive less
  // often. The one that matches nothing is the one that says so.
  it.each(['live', 'daily', 'weekly'] as const)(
    'matches every event when subscribed %s',
    subscription => {
      expect(happeningsOf(subscription)).toEqual([
        'reported',
        'picked-up',
        'needs-help',
        'parked',
        'resolved',
      ]);
    }
  );

  it('matches nothing when somebody has turned it off', () => {
    expect(happeningsOf('none')).toEqual([]);
  });

  it('counts only the rules that actually send something', () => {
    const sounding = soundingScopes(
      preferencesFor(member, equipment, areas)
    ).map(scope => scope.id);
    expect(sounding).toContain('reported-by-me');
    expect(sounding).toContain('my-areas');
    expect(sounding).toContain(`area:${WOOD}`);
    expect(sounding).not.toContain('other-areas');
  });

  it('still gives somebody with no areas the rules that apply to them', () => {
    const scopes = preferencesFor({ownerOf: [], trainerFor: []}, [], []);
    expect(find(scopes, 'my-areas').children).toEqual([]);
    expect(find(scopes, 'reported-by-me').effective).toBe('live');
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
