import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';
import {constructEvent, EmailAddress} from '../../../src/types';
import {create} from '../../../src/commands/purchasing-area/create';
import {
  arbitraryActor,
  getRightOrFail,
  getTaskEitherRightOrFail,
} from '../../helpers';
import {
  TestFramework,
  initTestFramework,
} from '../../read-models/test-framework';

describe('create purchasing area', () => {
  let framework: TestFramework;
  const id = faker.string.uuid() as UUID;
  const command = {
    id,
    name: 'Craft & Art' as NonEmptyString,
    yearlyBudget: 150_000,
    actor: arbitraryActor(),
  };

  beforeEach(async () => {
    framework = await initTestFramework();
  });

  afterEach(() => {
    framework.close();
  });

  it('reads the yearly budget in pounds', () => {
    expect(
      getRightOrFail(
        create.decode({id, name: 'Craft & Art', yearlyBudget: '1,500.00'})
      )
    ).toStrictEqual({id, name: 'Craft & Art', yearlyBudget: 150_000});
  });

  describe('when it does not exist yet', () => {
    it('creates it, with the budget in pence', async () => {
      const result = await getTaskEitherRightOrFail(
        create.process({command, rm: framework.sharedReadModel})
      );
      expect(result).toStrictEqual(
        O.some(
          expect.objectContaining({
            type: 'PurchasingAreaCreated',
            id,
            name: 'Craft & Art',
            yearlyBudgetPence: 150_000,
          })
        )
      );
    });
  });

  describe('when it already exists', () => {
    it('does nothing', async () => {
      framework.insertIntoSharedReadModel(
        constructEvent('PurchasingAreaCreated')({
          actor: arbitraryActor(),
          id,
          name: 'Craft & Art',
          yearlyBudgetPence: 150_000,
        })
      );
      const result = await getTaskEitherRightOrFail(
        create.process({command, rm: framework.sharedReadModel})
      );
      expect(result).toStrictEqual(O.none);
    });
  });

  describe('who may create one', () => {
    const memberNumber = faker.number.int({min: 1, max: 100_000});
    const user = {
      tag: 'user' as const,
      user: {
        memberNumber,
        emailAddress: faker.internet.email() as EmailAddress,
      },
    };

    beforeEach(() => {
      framework.insertIntoSharedReadModel(
        constructEvent('MemberNumberLinkedToEmail')({
          actor: arbitraryActor(),
          memberNumber,
          email: user.user.emailAddress,
          name: undefined,
          formOfAddress: undefined,
        })
      );
    });

    it('is not an ordinary member', () => {
      expect(
        create.isAuthorized({
          actor: user,
          rm: framework.sharedReadModel,
          input: command,
        })
      ).toBe(false);
    });

    it('is a super user', () => {
      framework.insertIntoSharedReadModel(
        constructEvent('SuperUserDeclared')({
          actor: arbitraryActor(),
          memberNumber,
        })
      );
      expect(
        create.isAuthorized({
          actor: user,
          rm: framework.sharedReadModel,
          input: command,
        })
      ).toBe(true);
    });
  });
});
