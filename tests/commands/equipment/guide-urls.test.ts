import * as O from 'fp-ts/Option';
import * as E from 'fp-ts/Either';
import {faker} from '@faker-js/faker';
import {UUID} from 'io-ts-types';
import {constructEvent} from '../../../src/types';
import {getTaskEitherRightOrFail, systemActor} from '../../helpers';
import {setGuideUrl} from '../../../src/commands/equipment/set-guide-url';
import {slugMatches} from '../../../src/templates/slug';
import {
  TestFramework,
  initTestFramework,
} from '../../read-models/test-framework';

// The real list for one area, as supplied.
const WOOD_SHOP_GUIDES = [
  'https://equipment.makespace.org/wood-shop/band-saw',
  'https://equipment.makespace.org/wood-shop/hammer-a3-31-planerthicknesser',
  'https://equipment.makespace.org/wood-shop/festool-of1010-router',
  'https://equipment.makespace.org/wood-shop/drill-press-jig',
  'https://equipment.makespace.org/wood-shop/cnc-router',
  'https://equipment.makespace.org/wood-shop/plunge-saw',
  'https://equipment.makespace.org/wood-shop/domino-joiner',
  'https://equipment.makespace.org/wood-shop/mitre-saw',
  'https://equipment.makespace.org/wood-shop/tormek',
  'https://equipment.makespace.org/wood-shop/wood-lathe',
  'https://equipment.makespace.org/wood-shop/sharpening-stones',
  'https://equipment.makespace.org/wood-shop/woodworking-handtools-cabinet',
];

// How the bulk import identifies a machine from an address.
const slugOf = (url: string) =>
  url.split('?')[0].split('#')[0].replace(/\/+$/, '').split('/').pop() ?? '';

describe('recording where to read about a machine', () => {
  let framework: TestFramework;
  let equipmentId: UUID;

  beforeEach(async () => {
    framework = await initTestFramework();
    const areaId = faker.string.uuid() as UUID;
    equipmentId = faker.string.uuid() as UUID;
    framework.insertIntoSharedReadModel(
      constructEvent('AreaCreated')({
        actor: systemActor(),
        id: areaId,
        name: 'Wood Shop',
      })
    );
    framework.insertIntoSharedReadModel(
      constructEvent('EquipmentAdded')({
        actor: systemActor(),
        category: 'red',
        id: equipmentId,
        name: 'Band Saw',
        areaId,
      })
    );
  });

  afterEach(() => {
    framework.close();
  });

  describe('the address itself', () => {
    it('is recorded', async () => {
      const result = await getTaskEitherRightOrFail(
        setGuideUrl.process({
          command: {
            equipmentId,
            url: 'https://equipment.makespace.org/wood-shop/band-saw',
            actor: systemActor(),
          },
          rm: framework.sharedReadModel,
        })
      );
      expect(O.toNullable(result)).toEqual(
        expect.objectContaining({
          type: 'EquipmentGuideUrlSet',
          url: 'https://equipment.makespace.org/wood-shop/band-saw',
        })
      );
    });

    it('must be a web address, since members will follow it', () => {
      expect(
        E.isLeft(setGuideUrl.decode({equipmentId, url: 'not a url'}))
      ).toBe(true);
      expect(
        E.isLeft(
          setGuideUrl.decode({equipmentId, url: 'javascript:alert(1)'})
        )
      ).toBe(true);
    });

    it('can be cleared', () => {
      const decoded = setGuideUrl.decode({equipmentId, url: '  '});
      expect(E.isRight(decoded) && decoded.right.url).toBe('');
    });
  });

  // The bulk import matches each address to a machine by its last segment,
  // which is that site's own name for the thing.
  describe('matching a pasted list to machines', () => {
    it('finds the machine for each address in a real area list', () => {
      const names = [
        'Band Saw',
        'Hammer A3-31 Planer/Thicknesser',
        'Festool OF1010 Router',
        'Drill Press & Jig',
        'CNC Router',
        'Plunge Saw',
        'Domino Joiner',
        'Mitre Saw',
        'Tormek',
        'Wood Lathe',
        'Sharpening Stones',
        'Woodworking Handtools Cabinet',
      ];

      const unmatched = WOOD_SHOP_GUIDES.filter(
        url => !names.some(name => slugMatches(name, slugOf(url)))
      );

      expect(unmatched).toEqual([]);
    });

    // The two systems punctuate differently, which is a matching problem
    // rather than a reason to reject an address.
    it('matches across differences in punctuation', () => {
      expect(
        slugMatches(
          'Hammer A3-31 Planer/Thicknesser',
          'hammer-a3-31-planerthicknesser'
        )
      ).toBe(true);
      expect(slugMatches('Drill Press & Jig', 'drill-press-jig')).toBe(true);
    });

    it('does not match two different machines', () => {
      expect(slugMatches('Band Saw', 'mitre-saw')).toBe(false);
      expect(slugMatches('Wood Lathe', 'metal-lathe')).toBe(false);
    });

    it('ignores a trailing slash and a query string', () => {
      expect(slugOf('https://equipment.makespace.org/wood-shop/tormek/')).toBe(
        'tormek'
      );
      expect(
        slugOf('https://equipment.makespace.org/wood-shop/tormek?from=sign')
      ).toBe('tormek');
    });
  });
});
