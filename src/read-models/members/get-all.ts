import {Actor, User} from '../../types';

export const liftActorOrUser = (actorOrUser: Actor | User) =>
  Actor.is(actorOrUser)
    ? actorOrUser
    : {
        tag: 'user' as const,
        user: actorOrUser,
      };
