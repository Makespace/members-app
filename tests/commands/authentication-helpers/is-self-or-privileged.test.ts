import { isSelfOrPrivileged } from '../../../src/commands/authentication-helpers/is-self-or-privileged';
import {constructEvent} from '../../../src/types';
import {Actor} from '../../../src/types/actor';
import {arbitraryActor} from '../../helpers';
import { initTestFramework, TestFramework } from '../../read-models/test-framework';
import {arbitraryUser} from '../../types/user.helper';

describe('isSelfOrPrivileged', () => {
  let framework: TestFramework;
  beforeEach(async () => {
    framework = await initTestFramework();
  });
  afterEach(() => {
    framework.close();
  });

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
          actor: arbitraryActor(),
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
          actor: arbitraryActor(),
        }),
        constructEvent('SuperUserRevoked')({
          memberNumber: userToBeSuperUser.memberNumber,
          actor: arbitraryActor(),
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
          actor: arbitraryActor(),
        }),
        constructEvent('SuperUserRevoked')({
          memberNumber: userToBeSuperUser.memberNumber,
          actor: arbitraryActor(),
        }),
        constructEvent('SuperUserDeclared')({
          memberNumber: userToBeSuperUser.memberNumber,
          actor: arbitraryActor(),
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
    expect(isSelfOrPrivileged({actor, rm: framework.sharedReadModel, input})).toBe(expected);
  });
});
