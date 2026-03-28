import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {declare} from '../../../src/commands/super-user/declare';
import {constructEvent} from '../../../src/types';
import {arbitraryActor, getRightOrFail} from '../../helpers';
import { initTestFramework, TestFramework } from '../../read-models/test-framework';
import { pipe } from 'fp-ts/lib/function';

describe('declare-super-user', () => {
  let framework: TestFramework;
  beforeEach(async () => {
    framework = await initTestFramework();
  });
  afterEach(() => {
    framework.close();
  });
  describe('when the member is currently not a super user', () => {
    const memberNumber = faker.number.int();

    it('declares them to be super user', async () => {
      const result = pipe(
        await declare.process({
          command: {
            memberNumber,
            actor: arbitraryActor(),
          },
          events: [],
          deps: framework,
        })(),
        getRightOrFail,
      );
      expect(result).toStrictEqual(
        O.some(
          expect.objectContaining({type: 'SuperUserDeclared', memberNumber})
        )
      );
    });
  });

  describe('when the member was previously a super user', () => {
    const memberNumber = faker.number.int();
    it('declares them to be super user', async () => {
      const result = pipe(
        await declare.process({
          command: {
            memberNumber,
            actor: arbitraryActor(),
          },
          events: [
            constructEvent('SuperUserDeclared')({
              memberNumber,
              actor: arbitraryActor(),
            }),
            constructEvent('SuperUserRevoked')({
              memberNumber,
              actor: arbitraryActor(),
            }),
          ],
          deps: framework,
        })(),
        getRightOrFail
      );
      expect(result).toStrictEqual(
        O.some(
          expect.objectContaining({type: 'SuperUserDeclared', memberNumber})
        )
      );
    });
  });
});
