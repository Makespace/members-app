import * as O from 'fp-ts/Option';
import * as E from 'fp-ts/Either';
import {faker} from '@faker-js/faker';
import {StatusCodes} from 'http-status-codes';
import {NonEmptyString, UUID} from 'io-ts-types';
import {v4} from 'uuid';
import {constructEvent} from '../../../src/types';
import {markEquipmentObsolete} from '../../../src/commands/equipment/mark-obsolete';
import {
  arbitraryActor,
  getLeftOrFail,
  getRightOrFail,
  getTaskEitherRightOrFail,
} from '../../helpers';
import {
  TestFramework,
  initTestFramework,
} from '../../read-models/test-framework';

describe('mark-obsolete', () => {
  let framework: TestFramework;

  beforeEach(async () => {
    framework = await initTestFramework();
  });

  afterEach(() => {
    framework.close();
  });

  describe('when the equipment does not exist', () => {
    it('fails with not found', async () => {
      const result = getLeftOrFail(
        await markEquipmentObsolete.process({
          command: {id: v4() as UUID, actor: arbitraryActor()},
          rm: framework.sharedReadModel,
        })()
      );

      expect(result).toMatchObject({
        message: 'The requested equipment does not exist',
        status: StatusCodes.NOT_FOUND,
      });
    });
  });

  describe('when the equipment exists', () => {
    const areaId = v4() as UUID;
    const equipmentId = v4() as UUID;
    const command = {id: equipmentId, actor: arbitraryActor()};
    beforeEach(() => {
      framework.insertIntoSharedReadModel(
        constructEvent('AreaCreated')({
          id: areaId,
          name: faker.commerce.productName() as NonEmptyString,
          actor: arbitraryActor(),
        })
      );
      framework.insertIntoSharedReadModel(
        constructEvent('EquipmentAdded')({
          id: equipmentId,
          name: faker.commerce.productName(),
          areaId,
          actor: arbitraryActor(),
        })
      );
    });
    it('records an EquipmentMarkedObsolete event', async () => {
      const result = await getTaskEitherRightOrFail(
        markEquipmentObsolete.process({
          command,
          rm: framework.sharedReadModel,
        })
      );

      expect(result).toStrictEqual(
        O.some(
          expect.objectContaining({
            type: 'EquipmentMarkedObsolete',
            id: equipmentId,
          })
        )
      );
    });

    describe('when the equipment is already obsolete', () => {
      beforeEach(() => {
        framework.insertIntoSharedReadModel(
          constructEvent('EquipmentMarkedObsolete')({
            id: equipmentId,
            actor: arbitraryActor(),
          })
        );
      });
      describe('mark equipment as obsolete', () => {
        let result: E.Either<unknown, unknown>;
        beforeEach(async () => {
          result = await markEquipmentObsolete.process({
            command,
            rm: framework.sharedReadModel,
          })();
        });
        
        it('is a no-op (idempotent), without failing', async () => {
          expect(getRightOrFail(result)).toStrictEqual(O.none);
        });
      });
    });
  });
});
