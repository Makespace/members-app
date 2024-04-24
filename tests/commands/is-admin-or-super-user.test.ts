import {faker} from '@faker-js/faker';
import {constructEvent} from '../../src/types';
import {Actor} from '../../src/types/actor';
import {arbitraryUser} from '../types/user.helper';
import {isAdminOrSuperUser} from '../../src/commands/is-admin-or-super-user';

describe('isAdminOrSuperUser', () => {
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
    expect(isAdminOrSuperUser({actor, events})).toBe(expected);
  });
});
