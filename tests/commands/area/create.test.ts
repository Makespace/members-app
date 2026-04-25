import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';
import {create} from '../../../src/commands/area/create';
import {constructEvent} from '../../../src/types';
import {v4} from 'uuid';
import {arbitraryActor, getTaskEitherRightOrFail} from '../../helpers';
import {
  TestFramework,
  initTestFramework,
} from '../../read-models/test-framework';

describe('create-area', () => {
  let framework: TestFramework;

  beforeEach(async () => {
    framework = await initTestFramework();
  });

  afterEach(() => {
    framework.close();
  });

  describe('when the area does not yet exist', () => {
    const areaName = faker.commerce.productName() as NonEmptyString;
    it('creates the area', async () => {
      const result = await getTaskEitherRightOrFail(
        create.process({
          command: {
            id: v4() as UUID,
            name: areaName,
            actor: arbitraryActor(),
          },
          events: [],
          rm: framework.sharedReadModel,
        })
      );

      expect(result).toStrictEqual(
        O.some(
          expect.objectContaining({
            type: 'AreaCreated',
            name: areaName,
          })
        )
      );
    });
  });

  describe('when the area already exists', () => {
    const areaName = faker.commerce.productName() as NonEmptyString;
    it('does nothing', async () => {
      const id = v4() as UUID;
      framework.insertIntoSharedReadModel(
        constructEvent('AreaCreated')({
          id,
          name: areaName,
          actor: arbitraryActor(),
        })
      );

      const result = await getTaskEitherRightOrFail(
        create.process({
          command: {
            id,
            name: areaName,
            actor: arbitraryActor(),
          },
          events: [],
          rm: framework.sharedReadModel,
        })
      );

      expect(result).toStrictEqual(O.none);
    });
  });
});
