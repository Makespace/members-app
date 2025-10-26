import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';
import {constructEvent} from '../../../src/types';
import {v4} from 'uuid';
import {arbitraryActor} from '../../helpers';
import {removeArea} from '../../../src/commands/area/remove-area';

describe('remove-area', () => {
  const areaId = v4() as UUID;
  const areaName = faker.commerce.productName() as NonEmptyString;
  const command = {
    id: areaId,
    actor: arbitraryActor(),
  };

  describe('when the area does not yet exist', () => {
    const result = removeArea.process({
      command,
      events: [],
    });

    it('does nothing', () => {
      expect(result).toStrictEqual(O.none);
    });
  });

  describe('when the area already exists', () => {
    const result = removeArea.process({
      command,
      events: [
        constructEvent('AreaCreated')({
          id: areaId,
          name: areaName,
          actor: arbitraryActor(),
        }),
      ],
    });

    it('removes the area', () => {
      expect(result).toStrictEqual(
        O.some(
          expect.objectContaining({
            type: 'AreaRemoved',
            id: areaId,
          })
        )
      );
    });
  });

  describe('when the area is already removed', () => {
    const result = removeArea.process({
      command: {
        id: areaId,
        actor: arbitraryActor(),
      },
      events: [
        constructEvent('AreaCreated')({
          id: areaId,
          name: areaName,
          actor: arbitraryActor(),
        }),
        constructEvent('AreaRemoved')({id: areaId, actor: arbitraryActor()}),
      ],
    });

    it('does nothing', () => {
      expect(result).toStrictEqual(O.none);
    });
  });
});
