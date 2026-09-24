import * as E from 'fp-ts/Either';
import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';
import * as O from 'fp-ts/Option';
import {setGuideUrl} from '../../../src/commands/equipment/set-guide-url';
import {
  TestFramework,
  initTestFramework,
} from '../../read-models/test-framework';

// The address ends up on a poster stuck to a machine, so a typo caught at the
// form costs nothing and a typo caught after printing costs fifty posters.
describe('recording an equipment guide address', () => {
  const equipmentId = faker.string.uuid() as UUID;

  const decode = (guideUrl: string) =>
    setGuideUrl.decode({equipmentId, guideUrl});

  it('accepts a web address', () => {
    const result = decode('https://equipment.makespace.org/wood-shop/band-saw');

    expect(E.isRight(result)).toBe(true);
  });

  it('accepts an empty value, which clears the link', () => {
    expect(decode('')).toStrictEqual(E.right({equipmentId, guideUrl: ''}));
  });

  it.each([
    ['equipment.makespace.org/wood-shop/band-saw'],
    ['the wood shop page'],
    ['javascript:alert(1)'],
    ['ftp://example.com/guide'],
  ])('rejects %s, which is not a web address', value => {
    expect(E.isLeft(decode(value))).toBe(true);
  });

  it('trims whatever was pasted', () => {
    expect(
      decode('  https://equipment.makespace.org/wood-shop/band-saw  ')
    ).toStrictEqual(
      E.right({
        equipmentId,
        guideUrl: 'https://equipment.makespace.org/wood-shop/band-saw',
      })
    );
  });

  describe('once recorded', () => {
    let framework: TestFramework;
    const areaId = faker.string.uuid() as UUID;

    beforeEach(async () => {
      framework = await initTestFramework();
      await framework.commands.area.create({
        id: areaId,
        name: 'Wood Shop' as NonEmptyString,
      });
      await framework.commands.equipment.add({
        id: equipmentId,
        name: 'Band Saw' as NonEmptyString,
        areaId,
      });
    });

    afterEach(() => {
      framework.close();
    });

    const stored = () =>
      O.chain((equipment: {guideUrl: O.Option<string>}) => equipment.guideUrl)(
        framework.sharedReadModel.equipment.get(equipmentId)
      );

    it('is readable against the equipment', async () => {
      await framework.commands.equipment.setGuideUrl({
        equipmentId,
        guideUrl: 'https://equipment.makespace.org/wood-shop/band-saw',
      });

      expect(stored()).toStrictEqual(
        O.some('https://equipment.makespace.org/wood-shop/band-saw')
      );
    });

    it('can be replaced when the guide moves', async () => {
      await framework.commands.equipment.setGuideUrl({
        equipmentId,
        guideUrl: 'https://equipment.makespace.org/wood-shop/band-saw',
      });
      await framework.commands.equipment.setGuideUrl({
        equipmentId,
        guideUrl: 'https://equipment.makespace.org/wood-shop/bandsaw-2',
      });

      expect(stored()).toStrictEqual(
        O.some('https://equipment.makespace.org/wood-shop/bandsaw-2')
      );
    });

    it('can be cleared, leaving no link rather than a stale one', async () => {
      await framework.commands.equipment.setGuideUrl({
        equipmentId,
        guideUrl: 'https://equipment.makespace.org/wood-shop/band-saw',
      });
      await framework.commands.equipment.setGuideUrl({
        equipmentId,
        guideUrl: '',
      });

      expect(stored()).toStrictEqual(O.none);
    });
  });
});
