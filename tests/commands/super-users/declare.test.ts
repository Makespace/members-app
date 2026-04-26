import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {declare} from '../../../src/commands/super-user/declare';
import { DomainEvent, EmailAddress} from '../../../src/types';
import {arbitraryActor, getLeftOrFail, getSomeOrFail, getTaskEitherRightOrFail} from '../../helpers';
import {
  TestFramework,
  initTestFramework,
} from '../../read-models/test-framework';

describe('declare-super-user', () => {
  let framework: TestFramework;

  beforeEach(async () => {
    framework = await initTestFramework();
  });

  afterEach(() => {
    framework.close();
  });
  const memberNumber = faker.number.int();
  beforeEach(async () => {
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber,
      email: faker.internet.email() as EmailAddress,
      name: undefined,
      formOfAddress: undefined
    });
  });

  it('declaring a non-existent member fails', async () => {
    getLeftOrFail(await declare.process({
        command: {
          memberNumber: faker.number.int({min: memberNumber + 1}),
          actor: arbitraryActor(),
        },
        rm: framework.sharedReadModel,
      })()
    );
  });

  describe('when the member is currently not a super user', () => {
    describe('declares them to be a super user', () => {
      let result: DomainEvent;
      beforeEach(async () => {

        result = getSomeOrFail(await getTaskEitherRightOrFail(
          declare.process({
            command: {
              memberNumber,
              actor: arbitraryActor(),
            },
            rm: framework.sharedReadModel,
          })
        ));
        framework.insertIntoSharedReadModel(result);
      });

      it('generates a declared event', () => {
        expect(result).toStrictEqual(
          expect.objectContaining({type: 'SuperUserDeclared', memberNumber})
        );
      });

      it('declaring them again is a no-op', async () => {
        const resultAgain = await getTaskEitherRightOrFail(
          declare.process({
            command: {
              memberNumber,
              actor: arbitraryActor(),
            },
            rm: framework.sharedReadModel,
          })
        );
        expect(resultAgain).toStrictEqual(O.none);
      });

      describe('revokes them as a super user', () => {
        beforeEach(async () => {
          await framework.commands.superUser.revoke({
            memberNumber
          });
        });

        it('declares again produces a declare event', async () => {
          const resultAfterRevoke = await getTaskEitherRightOrFail(
            declare.process({
              command: {
                memberNumber,
                actor: arbitraryActor(),
              },
              rm: framework.sharedReadModel,
            })
          );

          expect(resultAfterRevoke).toStrictEqual(
            O.some(
              expect.objectContaining({type: 'SuperUserDeclared', memberNumber})
            )
          );
        });
      });
    });
  });

});
