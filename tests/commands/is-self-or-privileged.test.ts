import {isSelfOrPrivileged} from '../../src/commands/is-self-or-privileged';
import {constructEvent} from '../../src/types';
import {Actor} from '../../src/types/actor';
import {arbitraryUser} from '../types/user.helper';

describe('isSelfOrPrivileged', () => {
  const userToBeSuperUser = arbitraryUser();
  const self = arbitraryUser();

  it.each([
    [
      'admin via token',
      true,
      {tag: 'token', token: 'admin'} satisfies Actor,
      [],
      {
        memberNumber: self.memberNumber,
      },
    ],
    [
      'super user',
      true,
      {tag: 'user', user: userToBeSuperUser} satisfies Actor,
      [
        constructEvent('SuperUserDeclared')({
          memberNumber: userToBeSuperUser.memberNumber,
        }),
      ],
      {
        memberNumber: self.memberNumber,
      },
    ],
    [
      'revoked super user',
      false,
      {tag: 'user', user: userToBeSuperUser} satisfies Actor,
      [
        constructEvent('SuperUserDeclared')({
          memberNumber: userToBeSuperUser.memberNumber,
        }),
        constructEvent('SuperUserRevoked')({
          memberNumber: userToBeSuperUser.memberNumber,
        }),
      ],
      {
        memberNumber: self.memberNumber,
      },
    ],
    [
      'reinstated super user',
      true,
      {tag: 'user', user: userToBeSuperUser} satisfies Actor,
      [
        constructEvent('SuperUserDeclared')({
          memberNumber: userToBeSuperUser.memberNumber,
        }),
        constructEvent('SuperUserRevoked')({
          memberNumber: userToBeSuperUser.memberNumber,
        }),
        constructEvent('SuperUserDeclared')({
          memberNumber: userToBeSuperUser.memberNumber,
        }),
      ],
      {
        memberNumber: self.memberNumber,
      },
    ],
    [
      'other user',
      false,
      {tag: 'user', user: arbitraryUser()} satisfies Actor,
      [],
      {
        memberNumber: self.memberNumber,
      },
    ],
    [
      'self',
      true,
      {tag: 'user', user: self} satisfies Actor,
      [],
      {
        memberNumber: self.memberNumber,
      },
    ],
  ])('%s: %s', (_, expected, actor, events, input) => {
    expect(isSelfOrPrivileged({actor, events, input})).toBe(expected);
  });
});
