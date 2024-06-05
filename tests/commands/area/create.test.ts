import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';
import {create} from '../../../src/commands/area/create';
import {constructEvent} from '../../../src/types';
import {v4} from 'uuid';
import {arbitraryActor} from '../../helpers';

describe('create-area', () => {
  describe('when the area does not yet exist', () => {
    const areaName = faker.commerce.productName() as NonEmptyString;
    const areaDescription = faker.commerce.productDescription();
    const result = create.process({
      command: {
        id: v4() as UUID,
        name: areaName,
        description: areaDescription,
        actor: arbitraryActor(),
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
        id: v4() as UUID,
        name: areaName,
        description: areaDescription,
        actor: arbitraryActor(),
      },
      events: [
        constructEvent('AreaCreated')({
          id: v4() as UUID,
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
