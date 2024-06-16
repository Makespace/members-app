import {isAdminOrSuperUser} from './is-admin-or-super-user';
import {DomainEvent, Actor} from '../types';

interface Args {
  actor: Actor;
  events: ReadonlyArray<DomainEvent>;
  input: {
    memberNumber: number;
  };
}

const isSelf = (args: Args) => {
  const {actor, input} = args;
  return actor.tag === 'user' && actor.user.memberNumber === input.memberNumber;
};

export const isSelfOrPrivileged = (args: Args) =>
  isAdminOrSuperUser(args) || isSelf(args);
