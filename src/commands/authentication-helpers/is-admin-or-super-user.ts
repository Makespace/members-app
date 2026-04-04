import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import { Actor } from '../../types';
import { SharedReadModel } from '../../read-models/shared-state';

export const isAdminOrSuperUser = (input: {
  actor: Actor;
  rm: SharedReadModel;
}) => {
  switch (input.actor.tag) {
    case 'token':
      return input.actor.token === 'admin';
    case 'user':
      return pipe(
        input.actor.user.memberNumber,
        input.rm.members.get,
        O.match(
          () => false,
          m => m.isSuperUser
        )
      );
    default:
      return false;
  }
};
