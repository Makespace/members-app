import * as O from 'fp-ts/Option';
import {declareSuperUser} from '../../src/commands/declare-super-user';
import {faker} from '@faker-js/faker';
import {constructEvent} from '../../src/types';
import {Actor} from '../../src/types/actor';
import {arbitraryUser} from '../types/user.helper';

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

  describe('isAuthorized', () => {
    const userToBeSuperUser = arbitraryUser();
    it.each([
      [
        'admin via token',
        true,
        {tag: 'token', token: 'admin'} satisfies Actor,
        [],
      ],
      [
        'super user',
        true,
        {tag: 'user', user: userToBeSuperUser} satisfies Actor,
        [
          constructEvent('SuperUserDeclared')({
            memberNumber: userToBeSuperUser.memberNumber,
            declaredAt: faker.date.anytime(),
          }),
        ],
      ],
      [
        'other user',
        false,
        {tag: 'user', user: arbitraryUser()} satisfies Actor,
        [],
      ],
    ])('%s: %s', (_, expected, actor, events) => {
      expect(declareSuperUser.isAuthorized({actor, events})).toBe(expected);
    });
  });
});
