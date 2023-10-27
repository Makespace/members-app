import {faker} from '@faker-js/faker';
import {pipe} from 'fp-ts/lib/function';
import {constructEvent} from '../../../src/types';
import {arbitraryUser} from '../../types/user.helper';
import {is} from '../../../src/queries/super-users/is';

describe('is', () => {
  describe('when there are no super-users', () => {
    const isSuperUser = pipe([], is(arbitraryUser().memberNumber));
    it('returns false', () => {
      expect(isSuperUser).toBe(false);
    });
  });

  describe('when the user is a super-user', () => {
    const user = arbitraryUser();
    const isSuperUser = pipe(
      [
        constructEvent('SuperUserDeclared')({
          memberNumber: user.memberNumber,
          declaredAt: faker.date.past(),
        }),
      ],
      is(user.memberNumber)
    );

    it('returns true', () => {
      expect(isSuperUser).toBe(true);
    });
  });

  describe('when a super-user status was revoked', () => {
    const revokedUser = arbitraryUser();
    const isSuperUser = pipe(
      [
        constructEvent('SuperUserDeclared')({
          memberNumber: revokedUser.memberNumber,
          declaredAt: faker.date.past(),
        }),
        constructEvent('SuperUserRevoked')({
          memberNumber: revokedUser.memberNumber,
          revokedAt: faker.date.past(),
        }),
      ],
      is(revokedUser.memberNumber)
    );

    it('returns false', () => {
      expect(isSuperUser).toBe(false);
    });
  });
});
