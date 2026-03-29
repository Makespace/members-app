import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {StatusCodes} from 'http-status-codes';
import {NonEmptyString, UUID} from 'io-ts-types';
import {constructEvent} from '../../../src/types';
import {v4} from 'uuid';
import {
  arbitraryActor,
  getLeftOrFail,
  getTaskEitherRightOrFail,
} from '../../helpers';
import {removeArea} from '../../../src/commands/area/remove-area';

describe('remove-area', () => {
  const areaId = v4() as UUID;
  const areaName = faker.commerce.productName() as NonEmptyString;
  const command = {
    id: areaId,
    actor: arbitraryActor(),
  };

  describe('when the area does not yet exist', () => {
    it('fails', async () => {
      const result = getLeftOrFail(
        await removeArea.process({
          command,
          events: [],
        })()
      );

      expect(result).toMatchObject({
        message: 'The requested area does not exist',
        status: StatusCodes.NOT_FOUND,
      });
    });
  });

  describe('when the area already exists', () => {
    it('removes the area', async () => {
      const result = await getTaskEitherRightOrFail(
        removeArea.process({
          command,
          events: [
            constructEvent('AreaCreated')({
              id: areaId,
              name: areaName,
              actor: arbitraryActor(),
            }),
          ],
        })
      );

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
    it('fails', async () => {
      const result = getLeftOrFail(
        await removeArea.process({
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
        })()
      );

      expect(result).toMatchObject({
        message: 'The requested area does not exist',
        status: StatusCodes.NOT_FOUND,
      });
    });
  });
});
