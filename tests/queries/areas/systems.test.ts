import {isSystemArea, partitionAreas} from '../../../src/queries/areas/systems';
import {AreaViewModel} from '../../../src/queries/areas/view-model';

// partitionAreas only reads id + name, so a minimal stub suffices here.
const area = (id: string, name: string): AreaViewModel =>
  ({id, name} as unknown as AreaViewModel);

describe('isSystemArea', () => {
  it('matches the known system area names, ignoring case and surrounding space', () => {
    expect(isSystemArea('Events')).toBe(true);
    expect(isSystemArea('  pat testing ')).toBe(true);
    expect(isSystemArea('IT Systems')).toBe(true);
  });

  it('treats everything else as not a system', () => {
    expect(isSystemArea('Wood Room')).toBe(false);
    expect(isSystemArea('Laser Area')).toBe(false);
    expect(isSystemArea('')).toBe(false);
  });
});

describe('partitionAreas', () => {
  it('splits into owned, systems, and other areas (ownership wins)', () => {
    const owned = area('a1', 'My Workshop');
    const system = area('a2', 'Events');
    const other = area('a3', 'Wood Room');
    const ownedSystem = area('a4', 'Marketing'); // owned even though system-named

    const {myAreas, makespaceAreas, systems} = partitionAreas(
      [owned, system, other, ownedSystem],
      new Set(['a1', 'a4'])
    );

    expect(myAreas.map(a => a.id)).toStrictEqual(['a1', 'a4']);
    expect(systems.map(a => a.id)).toStrictEqual(['a2']);
    expect(makespaceAreas.map(a => a.id)).toStrictEqual(['a3']);
  });

  it('preserves input order within each group', () => {
    const areas = [
      area('1', 'Alpha'),
      area('2', 'Events'),
      area('3', 'Beta'),
      area('4', 'Marketing'),
    ];

    const {makespaceAreas, systems} = partitionAreas(areas, new Set());

    expect(makespaceAreas.map(a => a.id)).toStrictEqual(['1', '3']);
    expect(systems.map(a => a.id)).toStrictEqual(['2', '4']);
  });
});
