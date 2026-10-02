import * as O from 'fp-ts/Option';
import {UUID} from 'io-ts-types';
import {
  allScopes,
  preferencesFor,
  ScopeNode,
  soundingScopes,
} from '../../src/trouble-tickets/notification-preferences';

const area = (id: string, name: string) => ({
  id,
  name,
  ownershipRecordedAt: new Date('2026-01-01T00:00:00.000Z'),
});

const equipment = (id: string, name: string) => ({
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

describe('what somebody hears about trouble tickets', () => {
  const member = {
    ownerOf: [area('a1', 'Wood Shop'), area('a2', 'Metal Shop')],
    trainerFor: [equipment('e1', 'Laser Cutter')],
  };

  it('gives every area they own a rule of its own', () => {
    const scopes = preferencesFor(member);
    expect(
      find(scopes, 'areas-i-own').children.map(child => child.label)
    ).toEqual(['Wood Shop', 'Metal Shop']);
  });

  it('gives every machine they train on a rule of its own', () => {
    const scopes = preferencesFor(member);
    expect(
      find(scopes, 'equipment-i-train-on').children.map(child => child.label)
    ).toEqual(['Laser Cutter']);
  });

  // The gap this whole feature exists to close: today an owner is told
  // nothing when a ticket is raised in their area.
  it('tells an owner when something in their area is reported', () => {
    const scopes = preferencesFor(member);
    const owned = find(scopes, 'areas-i-own');
    expect(owned.effective.delivery).toBe('as-it-happens');
    expect(owned.effective.happenings).toContain('reported');
  });

  it('tells a trainer when a machine they teach on needs help', () => {
    const scopes = preferencesFor(member);
    expect(find(scopes, 'equipment-i-train-on').effective.happenings).toEqual([
      'needs-help',
    ]);
  });

  it('stays quiet about everything nobody made them responsible for', () => {
    const scopes = preferencesFor(member);
    expect(find(scopes, 'everything').effective.delivery).toBe('never');
    expect(find(scopes, 'everywhere-else').effective.delivery).toBe('never');
  });

  // Inheriting is not the same as hearing nothing: the row still has an
  // effect, and it is the parent's.
  it('passes a parent rule down to a child that says nothing of its own', () => {
    const scopes = preferencesFor(member);
    const owned = find(scopes, 'areas-i-own');
    const woodShop = find(scopes, 'area:a1');
    expect(woodShop.setting.kind).toBe('inherit');
    expect(woodShop.effective).toStrictEqual(owned.effective);
    expect(woodShop.inheritsFrom).toStrictEqual(O.some('Areas I own'));
  });

  it('counts only the rules that actually send something', () => {
    const scopes = preferencesFor(member);
    const sounding = soundingScopes(scopes).map(scope => scope.id);
    // Owned areas and their two machines, the trainer group and its one
    // machine, and the tickets they reported themselves.
    expect(sounding).toContain('reported-by-me');
    expect(sounding).toContain('areas-i-own');
    expect(sounding).toContain('area:a1');
    expect(sounding).toContain('equipment:e1');
    expect(sounding).not.toContain('everything');
    expect(sounding).not.toContain('everywhere-else');
  });

  it('still gives a member with no areas the two rules that apply to them', () => {
    const scopes = preferencesFor({ownerOf: [], trainerFor: []});
    expect(find(scopes, 'areas-i-own').children).toEqual([]);
    expect(find(scopes, 'reported-by-me').effective.delivery).toBe(
      'as-it-happens'
    );
  });

  it('tells somebody about their own ticket being picked up and resolved', () => {
    const mine = find(preferencesFor(member), 'reported-by-me');
    expect(mine.effective.happenings).toEqual([
      'picked-up',
      'needs-help',
      'parked',
      'resolved',
    ]);
  });
});
