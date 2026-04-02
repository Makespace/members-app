import {constructEvent} from '../../../src/types';
import {Actor} from '../../../src/types/actor';
import {arbitraryUser} from '../../types/user.helper';
import {arbitraryActor} from '../../helpers';
import { isAdminOrSuperUser } from '../../../src/commands/authentication-helpers/is-admin-or-super-user';
import { initTestFramework, TestFramework } from '../../read-models/test-framework';

describe('isAdminOrSuperUser', () => {
  const userToBeSuperUser = arbitraryUser();
  const randomUser = arbitraryUser();
  let framework: TestFramework;
  beforeEach(async () => {
    framework = await initTestFramework();
    framework.sharedReadModel.updateState(
      constructEvent('MemberNumberLinkedToEmail')({
        memberNumber: userToBeSuperUser.memberNumber,
        email: userToBeSuperUser.emailAddress,
        formOfAddress: undefined,
        name: undefined,
        actor: arbitraryActor(),
      })
    );
    framework.sharedReadModel.updateState(
      constructEvent('MemberNumberLinkedToEmail')({
        memberNumber: randomUser.memberNumber,
        email: randomUser.emailAddress,
        formOfAddress: undefined,
        name: undefined,
        actor: arbitraryActor(),
      })
    );
  });
  afterEach(() => {
    framework.close();
  });

  
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
          actor: arbitraryActor(),
        }),
      ],
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
    ],
    [
      'other user',
      false,
      {tag: 'user', user: randomUser} satisfies Actor,
      [],
    ],
  ])('%s: %s', (_, expected, actor, events) => {
    events.forEach(framework.sharedReadModel.updateState);
    expect(isAdminOrSuperUser({actor, rm: framework.sharedReadModel})).toBe(expected);
  });
});
