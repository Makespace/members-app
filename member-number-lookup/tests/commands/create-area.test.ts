import * as O from 'fp-ts/Option';
import {createArea} from '../../src/commands/create-area';
import {faker} from '@faker-js/faker';
import {constructEvent} from '../../src/types';
import {NonEmptyString} from 'io-ts-types';

describe('create-area', () => {
  describe('when the area does not yet exist', () => {
    const areaName = faker.commerce.productName() as NonEmptyString;
    const areaDescription = faker.commerce.productDescription();
    const result = createArea.process({
      command: {
        name: areaName,
        description: areaDescription,
      },
      events: [],
    });
    it('creates the area', () => {
      expect(result).toStrictEqual(
        O.some(
          expect.objectContaining({
            type: 'AreaCreated',
            name: areaName,
            description: areaDescription,
          })
        )
      );
    });
  });

  describe('when the area already exists', () => {
    const areaName = faker.commerce.productName() as NonEmptyString;
    const areaDescription = faker.commerce.productDescription();
    const result = createArea.process({
      command: {
        name: areaName,
        description: areaDescription,
      },
      events: [
        constructEvent('AreaCreated')({
          name: areaName,
          description: areaDescription,
        }),
      ],
    });
    it('does nothing', () => {
      expect(result).toStrictEqual(O.none);
    });
  });
});
