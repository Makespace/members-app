import { SharedReadModel } from '../../read-models/shared-state';
import { Actor } from '../../types';
import {isAdminOrSuperUser} from './is-admin-or-super-user';
import { isSelf } from './is-self';

export const isSelfOrPrivileged = (input: {
  actor: Actor;
  rm: SharedReadModel;
  input: {
    memberNumber: number;
  };
}) =>
  isAdminOrSuperUser(input) || isSelf(input);
