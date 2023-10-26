import * as O from 'fp-ts/Option';
import {declareSuperUser} from '../../src/commands/declare-super-user';
import {faker} from '@faker-js/faker';
import {EmailAddress, User, constructEvent} from '../../src/types';
import {Actor} from '../../src/types/actor';

describe('declare-super-user', () => {
  describe('process', () => {
    describe('when the member is currently not a super user', () => {
      const memberNumber = faker.number.int();
      const result = declareSuperUser.process({
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
      const result = declareSuperUser.process({
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
  });

  const arbitraryUser = (): User => ({
    emailAddress: faker.internet.email() as EmailAddress,
    memberNumber: faker.number.int(),
  });

  describe('isAuthorized', () => {
    it.each([
      [{tag: 'token', token: 'admin'} satisfies Actor, true],
      [{tag: 'user', user: arbitraryUser()} satisfies Actor, false],
    ])('%s returns %s', (actor, expected) => {
      expect(declareSuperUser.isAuthorized({actor, events: []})).toBe(expected);
    });
  });
});
