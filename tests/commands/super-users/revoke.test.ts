import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {constructEvent} from '../../../src/types';
import {EmailAddress} from '../../../src/types/email-address';
import {revoke} from '../../../src/commands/super-user/revoke';
import {arbitraryActor, getTaskEitherRightOrFail} from '../../helpers';
import {
  TestFramework,
  initTestFramework,
} from '../../read-models/test-framework';

describe('revoke-super-user', () => {
  let framework: TestFramework;
  const linkMember = (memberNumber: number) =>
    framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber,
      email: faker.internet.email() as EmailAddress,
      name: undefined,
      formOfAddress: undefined,
    });

  beforeEach(async () => {
    framework = await initTestFramework();
  });

  afterEach(() => {
    framework.close();
  });

  describe('when the member is currently not a super user', () => {
    const memberNumber = faker.number.int();
    it('does nothing', async () => {
      const result = await getTaskEitherRightOrFail(
        revoke.process({
          command: {
            memberNumber,
            actor: arbitraryActor(),
          },
          events: [],
          rm: framework.sharedReadModel,
        })
      );

      expect(result).toStrictEqual(O.none);
    });
  });

  describe('when the member is already a super user', () => {
    const memberNumber = faker.number.int();
    it('revokes their status', async () => {
      await linkMember(memberNumber);
      framework.insertIntoSharedReadModel(
        constructEvent('SuperUserDeclared')({
          memberNumber,
          actor: arbitraryActor(),
        })
      );

      const result = await getTaskEitherRightOrFail(
        revoke.process({
          command: {
            memberNumber,
            actor: arbitraryActor(),
          },
          events: [],
          rm: framework.sharedReadModel,
        })
      );

      expect(result).toStrictEqual(
        O.some(
          expect.objectContaining({type: 'SuperUserRevoked', memberNumber})
        )
      );
    });
  });

  describe('when the member was re-declared as a super user', () => {
    const memberNumber = faker.number.int();
    it('revokes their status', async () => {
      await linkMember(memberNumber);
      framework.insertIntoSharedReadModel(
        constructEvent('SuperUserDeclared')({
          memberNumber,
          actor: arbitraryActor(),
        })
      );
      framework.insertIntoSharedReadModel(
        constructEvent('SuperUserRevoked')({
          memberNumber,
          actor: arbitraryActor(),
        })
      );
      framework.insertIntoSharedReadModel(
        constructEvent('SuperUserDeclared')({
          memberNumber,
          actor: arbitraryActor(),
        })
      );

      const result = await getTaskEitherRightOrFail(
        revoke.process({
          command: {
            memberNumber,
            actor: arbitraryActor(),
          },
          events: [],
          rm: framework.sharedReadModel,
        })
      );

      expect(result).toStrictEqual(
        O.some(
          expect.objectContaining({type: 'SuperUserRevoked', memberNumber})
        )
      );
    });
  });
});
