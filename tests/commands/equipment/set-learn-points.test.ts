import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';
import {setLearnPoints} from '../../../src/commands/equipment/set-learn-points';
import {
  TestFramework,
  initTestFramework,
} from '../../read-models/test-framework';

// The points are printed on a postcard-sized sign, so the limits are what
// fits, and are enforced at the form rather than discovered at the printer.
describe('saying what a sign lists under "Learn"', () => {
  const equipmentId = faker.string.uuid() as UUID;

  const decode = (learnPoints: string) =>
    setLearnPoints.decode({equipmentId, learnPoints});

  it('keeps one point per line, dropping pasted bullets and blank lines', () => {
    expect(
      decode(
        '- How to change the dust bag and dispose of it\n\n• How to tidy the equipment away after use  \n'
      )
    ).toStrictEqual(
      E.right({
        equipmentId,
        learnPoints:
          'How to change the dust bag and dispose of it\nHow to tidy the equipment away after use',
      })
    );
  });

  it('accepts an empty value, which goes back to the general sentence', () => {
    expect(decode('  \n ')).toStrictEqual(
      E.right({equipmentId, learnPoints: ''})
    );
  });

  it('rejects more points than fit on a sign', () => {
    expect(E.isLeft(decode('a\nb\nc\nd\ne\nf'))).toBe(true);
    expect(E.isRight(decode('a\nb\nc\nd\ne'))).toBe(true);
  });

  it('rejects a point too long to read at a glance', () => {
    expect(E.isLeft(decode('x'.repeat(101)))).toBe(true);
    expect(E.isRight(decode('x'.repeat(100)))).toBe(true);
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
        name: 'Dust Extractor' as NonEmptyString,
        areaId,
      });
    });

    afterEach(() => {
      framework.close();
    });

    const stored = () =>
      O.map((equipment: {learnPoints: ReadonlyArray<string>}) =>
        equipment.learnPoints
      )(framework.sharedReadModel.equipment.get(equipmentId));

    it('is readable against the equipment, point by point', async () => {
      await framework.commands.equipment.setLearnPoints({
        equipmentId,
        learnPoints: 'How to change the dust bag\nHow to tidy it away',
      });

      expect(stored()).toStrictEqual(
        O.some(['How to change the dust bag', 'How to tidy it away'])
      );
    });

    it('has none until somebody writes some', () => {
      expect(stored()).toStrictEqual(O.some([]));
    });

    it('can be cleared', async () => {
      await framework.commands.equipment.setLearnPoints({
        equipmentId,
        learnPoints: 'How to change the dust bag',
      });
      await framework.commands.equipment.setLearnPoints({
        equipmentId,
        learnPoints: '',
      });

      expect(stored()).toStrictEqual(O.some([]));
    });
  });
});
