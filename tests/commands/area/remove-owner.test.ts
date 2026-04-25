import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {StatusCodes} from 'http-status-codes';
import {NonEmptyString, UUID} from 'io-ts-types';
import {constructEvent} from '../../../src/types';
import {EmailAddress} from '../../../src/types/email-address';
import {v4} from 'uuid';
import {
  arbitraryActor,
  getLeftOrFail,
  getTaskEitherRightOrFail,
} from '../../helpers';
import {removeOwner} from '../../../src/commands/area/remove-owner';
import {
  TestFramework,
  initTestFramework,
} from '../../read-models/test-framework';

describe('remove-owner', () => {
  let framework: TestFramework;

  beforeEach(async () => {
    framework = await initTestFramework();
  });

  afterEach(() => {
    framework.close();
  });

  const areaId = v4() as UUID;
  const areaName = faker.commerce.productName() as NonEmptyString;
  const memberNumber = faker.number.int();
  const command = {
    areaId: areaId,
    memberNumber,
    actor: arbitraryActor(),
  };
  const linkMember = () =>
    framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber,
      email: faker.internet.email() as EmailAddress,
      name: undefined,
      formOfAddress: undefined,
    });

  describe('when the area does not exist', () => {
    it('fails', async () => {
      const result = getLeftOrFail(
        await removeOwner.process({
          command,
          events: [],
          rm: framework.sharedReadModel,
        })()
      );

      expect(result).toMatchObject({
        message: 'The requested area does not exist',
        status: StatusCodes.NOT_FOUND,
      });
    });
  });

  describe('when the area exists', () => {
    const areaCreated = constructEvent('AreaCreated')({
      id: areaId,
      name: areaName,
      actor: arbitraryActor(),
    });

    describe('and the member is an owner of it', () => {
      it('removes them as owner', async () => {
        await linkMember();
        framework.insertIntoSharedReadModel(areaCreated);
        framework.insertIntoSharedReadModel(
          constructEvent('OwnerAdded')({
            memberNumber,
            areaId,
            actor: arbitraryActor(),
          })
        );

        const result = await getTaskEitherRightOrFail(
          removeOwner.process({
            command,
            events: [],
            rm: framework.sharedReadModel,
          })
        );

        expect(result).toStrictEqual(
          O.some(
            expect.objectContaining({
              type: 'OwnerRemoved',
              areaId,
              memberNumber,
            })
          )
        );
      });
    });

    describe('and the member was an owner before the area has been removed', () => {
      it('fails', async () => {
        await linkMember();
        framework.insertIntoSharedReadModel(areaCreated);
        framework.insertIntoSharedReadModel(
          constructEvent('OwnerAdded')({
            memberNumber,
            areaId,
            actor: arbitraryActor(),
          })
        );
        framework.insertIntoSharedReadModel(
          constructEvent('AreaRemoved')({
            id: areaId,
            actor: arbitraryActor(),
          })
        );

        const result = getLeftOrFail(
          await removeOwner.process({
            command,
            events: [],
            rm: framework.sharedReadModel,
          })()
        );

        expect(result).toMatchObject({
          message: 'The requested area does not exist',
          status: StatusCodes.NOT_FOUND,
        });
      });
    });

    describe('and the member was never an owner of it', () => {
      it('fails', async () => {
        framework.insertIntoSharedReadModel(areaCreated);

        const result = getLeftOrFail(
          await removeOwner.process({
            command,
            events: [],
            rm: framework.sharedReadModel,
          })()
        );

        expect(result).toMatchObject({
          message: 'The requested member is not an owner of the requested area',
          status: StatusCodes.BAD_REQUEST,
        });
      });
    });

    describe('and the member is no longer an owner of it', () => {
      it('fails', async () => {
        await linkMember();
        framework.insertIntoSharedReadModel(areaCreated);
        framework.insertIntoSharedReadModel(
          constructEvent('OwnerAdded')({
            memberNumber,
            areaId,
            actor: arbitraryActor(),
          })
        );
        framework.insertIntoSharedReadModel(
          constructEvent('OwnerRemoved')({
            memberNumber,
            areaId,
            actor: arbitraryActor(),
          })
        );

        const result = getLeftOrFail(
          await removeOwner.process({
            command,
            events: [],
            rm: framework.sharedReadModel,
          })()
        );

        expect(result).toMatchObject({
          message: 'The requested member is not an owner of the requested area',
          status: StatusCodes.BAD_REQUEST,
        });
      });
    });
  });
});
