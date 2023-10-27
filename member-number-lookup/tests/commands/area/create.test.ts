import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {NonEmptyString} from 'io-ts-types';
import {create} from '../../../src/commands/area/create';
import {constructEvent} from '../../../src/types';

describe('create-area', () => {
  describe('when the area does not yet exist', () => {
    const areaName = faker.commerce.productName() as NonEmptyString;
    const areaDescription = faker.commerce.productDescription();
    const result = create.process({
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
    const result = create.process({
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
