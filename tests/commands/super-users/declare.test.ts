import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {declare} from '../../../src/commands/super-user/declare';
import {constructEvent} from '../../../src/types';
import {arbitraryActor} from '../../helpers';

describe('declare-super-user', () => {
  describe('when the member is currently not a super user', () => {
    const memberNumber = faker.number.int();
    const result = declare.process({
      command: {
        memberNumber,
        actor: arbitraryActor(),
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

  describe('when the member was previously a super user', () => {
    const memberNumber = faker.number.int();
    const result = declare.process({
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
