import * as RA from 'fp-ts/ReadonlyArray';
import {pipe} from 'fp-ts/lib/function';
import {constructEvent} from '../../../src/types';
import {arbitraryUser} from '../../types/user.helper';
import {getAll} from '../../../src/read-models/super-users/get-all';

describe('get-all', () => {
  describe('when there are no super-users', () => {
    const superUsers = pipe([], getAll());
    it('returns an empty array', () => {
      expect(superUsers).toStrictEqual([]);
    });
  });

  describe('when there are super-users', () => {
    const user = arbitraryUser();
    const superUsers = pipe(
      [
        constructEvent('SuperUserDeclared')({
          memberNumber: user.memberNumber,
        }),
      ],
      getAll(),
      RA.map(superUser => superUser.memberNumber)
    );

    it('returns them', () => {
      expect(superUsers).toStrictEqual([user.memberNumber]);
    });
  });

  describe('when a super-user status was revoked', () => {
    const revokedUser = arbitraryUser();
    const nonRevokedUser = arbitraryUser();
    const superUsers = pipe(
      [
        constructEvent('SuperUserDeclared')({
          memberNumber: revokedUser.memberNumber,
        }),
        constructEvent('SuperUserDeclared')({
          memberNumber: nonRevokedUser.memberNumber,
        }),
        constructEvent('SuperUserRevoked')({
          memberNumber: revokedUser.memberNumber,
        }),
      ],
      getAll(),
      RA.map(superUser => superUser.memberNumber)
    );
    it('does not return that user', () => {
      expect(superUsers).toStrictEqual([nonRevokedUser.memberNumber]);
    });
  });
});
