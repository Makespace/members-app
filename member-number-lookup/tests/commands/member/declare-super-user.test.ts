import * as O from 'fp-ts/Option';
import {declareSuperUser} from '../../../src/commands/member/declare-super-user';
import {faker} from '@faker-js/faker';
import {constructEvent} from '../../../src/types';

describe('declare-super-user', () => {
  describe('when the member is currently not a super user', () => {
    const memberNumber = faker.number.int();
    const result = declareSuperUser.process({
      command: {
        memberNumber,
      },
      events: [],
    });
    it.skip('declares them to be super user', () => {
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
