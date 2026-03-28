import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';
import {constructEvent} from '../../../src/types';
import {v4} from 'uuid';
import {arbitraryActor, getRightOrFail} from '../../helpers';
import {removeArea} from '../../../src/commands/area/remove-area';
import { initTestFramework, TestFramework } from '../../read-models/test-framework';
import { pipe } from 'fp-ts/lib/function';

describe('remove-area', () => {
  let framework: TestFramework;
  beforeEach(async () => {
    framework = await initTestFramework();
  });
  afterEach(() => {
    framework.close();
  });

  const areaId = v4() as UUID;
  const areaName = faker.commerce.productName() as NonEmptyString;
  const command = {
    id: areaId,
    actor: arbitraryActor(),
  };

  describe('when the area does not yet exist', () => {
    it('does nothing', async () => {
      const result = pipe(
        await removeArea.process({
          command,
          events: [],
          deps: framework,
        })(),
        getRightOrFail,
      );

      expect(result).toStrictEqual(O.none);
    });
  });

  describe('when the area already exists', () => {
    it('removes the area', async () => {
      const result = pipe(
        await removeArea.process({
          command,
          events: [
            constructEvent('AreaCreated')({
              id: areaId,
              name: areaName,
              actor: arbitraryActor(),
            }),
          ],
          deps: framework,
        })(),
        getRightOrFail,
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
    it('does nothing', async () => {
      const result = pipe(
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
          deps: framework,
        })(),
        getRightOrFail,
      );
      expect(result).toStrictEqual(O.none);
    });
  });
});
