import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {declare} from '../../../src/commands/super-user/declare';
import {constructEvent} from '../../../src/types';

describe('declare-super-user', () => {
  describe('when the member is currently not a super user', () => {
    const memberNumber = faker.number.int();
    const result = declare.process({
      command: {
        memberNumber,
        declaredAt: faker.date.soon(),
      },
      events: [],
    });

    it('declares them to be super user', () => {
      expect(result).toStrictEqual(
        O.some(
          expect.objectContaining({type: 'SuperUserDeclared', memberNumber})
        )
      );
    });
  });

  describe('when the member is already a super user', () => {
    const memberNumber = faker.number.int();
    const result = declare.process({
      command: {
        memberNumber,
        declaredAt: faker.date.soon(),
      },
      events: [
        constructEvent('SuperUserDeclared')({
          memberNumber,
          declaredAt: faker.date.past(),
        }),
      ],
    });

    it('does nothing', () => {
      expect(result).toStrictEqual(O.none);
    });
  });

  describe('when the member was previously a super user', () => {
    const memberNumber = faker.number.int();
    const result = declare.process({
      command: {
        memberNumber,
        declaredAt: faker.date.soon(),
      },
      events: [
        constructEvent('SuperUserDeclared')({
          memberNumber,
          declaredAt: faker.date.past(),
        }),
        constructEvent('SuperUserRevoked')({
          memberNumber,
          revokedAt: faker.date.past(),
        }),
      ],
    });

    it('declares them to be super user', () => {
      expect(result).toStrictEqual(
        O.some(
          expect.objectContaining({type: 'SuperUserDeclared', memberNumber})
        )
      );
    });
  });
});
