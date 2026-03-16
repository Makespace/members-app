import {liftActorOrUser} from '../../../src/read-models/members/get-all';
import {Actor, EmailAddress} from '../../../src/types';

describe('liftActorOrUser', () => {
  it('returns actors unchanged', () => {
    const systemActor: Actor = {tag: 'system'};
    const tokenActor: Actor = {tag: 'token', token: 'admin'};
    const userActor: Actor = {
      tag: 'user',
      user: {
        emailAddress: 'admin@example.com' as EmailAddress,
        memberNumber: 1337,
      },
    };
    expect(liftActorOrUser(systemActor)).toBe(systemActor);
    expect(liftActorOrUser(tokenActor)).toBe(tokenActor);
    expect(liftActorOrUser(userActor)).toBe(userActor);
  });

  it('lifts users', () => {
    const user = {
      emailAddress: 'admin@example.com' as EmailAddress,
      memberNumber: 1337,
    };
    expect(liftActorOrUser(user)).toEqual({
      tag: 'user',
      user,
    });
  });
});
