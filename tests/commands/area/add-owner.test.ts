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
import {addOwner} from '../../../src/commands/area/add-owner';
import {
  TestFramework,
  initTestFramework,
} from '../../read-models/test-framework';

describe('add-owner', () => {
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

  const areaCreated = constructEvent('AreaCreated')({
    id: areaId,
    name: areaName,
    actor: arbitraryActor(),
  });
  const areaRemoved = constructEvent('AreaRemoved')({
    id: areaId,
    actor: arbitraryActor(),
  });
  const ownerAdded = constructEvent('OwnerAdded')({
    memberNumber,
    areaId,
    actor: arbitraryActor(),
  });
  const ownerRemoved = constructEvent('OwnerRemoved')({
    memberNumber,
    areaId,
    actor: arbitraryActor(),
  });
  const ownerMember = constructEvent('MemberNumberLinkedToEmail')({
    memberNumber,
    email: faker.internet.email() as EmailAddress,
    name: undefined,
    formOfAddress: undefined,
    actor: arbitraryActor(),
  });

  describe('when the area does not exist', () => {
    it('fails', async () => {
      const result = getLeftOrFail(
        await addOwner.process({
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

  describe('when the area has been removed', () => {
    it('fails', async () => {
      framework.insertIntoSharedReadModel(areaCreated);
      framework.insertIntoSharedReadModel(areaRemoved);

      const result = getLeftOrFail(
        await addOwner.process({
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
    describe('and the member was never an owner of it', () => {
      it('adds them as owner', async () => {
        framework.insertIntoSharedReadModel(areaCreated);

        const result = await getTaskEitherRightOrFail(
          addOwner.process({
            command,
            events: [],
            rm: framework.sharedReadModel,
          })
        );

        expect(result).toStrictEqual(
          O.some(
            expect.objectContaining({
              type: 'OwnerAdded',
              areaId,
              memberNumber,
            })
          )
        );
      });
    });

    describe('and the member is no longer an owner of it', () => {
      it('adds them as owner', async () => {
        framework.insertIntoSharedReadModel(ownerMember);
        framework.insertIntoSharedReadModel(areaCreated);
        framework.insertIntoSharedReadModel(ownerAdded);
        framework.insertIntoSharedReadModel(ownerRemoved);

        const result = await getTaskEitherRightOrFail(
          addOwner.process({
            command,
            events: [],
            rm: framework.sharedReadModel,
          })
        );

        expect(result).toStrictEqual(
          O.some(
            expect.objectContaining({
              type: 'OwnerAdded',
              areaId,
              memberNumber,
            })
          )
        );
      });
    });

    describe('and the member is an owner', () => {
      it('does nothing', async () => {
        framework.insertIntoSharedReadModel(ownerMember);
        framework.insertIntoSharedReadModel(areaCreated);
        framework.insertIntoSharedReadModel(ownerAdded);

        const result = await getTaskEitherRightOrFail(
          addOwner.process({
            command,
            events: [],
            rm: framework.sharedReadModel,
          })
        );

        expect(result).toStrictEqual(O.none);
      });
    });
  });
});
