import {Actor} from '../../types';
import {SharedReadModel} from '../../read-models/shared-state';
import {isAdminOrSuperUser} from './is-admin-or-super-user';

// For commands the system itself raises (e.g. the going-forward quiz poller),
// as well as admins/super-users. Attributing poller-generated events to the
// system actor keeps the audit history honest (rather than "Admin via API").
export const isAdminSuperUserOrSystem = (input: {
  actor: Actor;
  rm: SharedReadModel;
}) => input.actor.tag === 'system' || isAdminOrSuperUser(input);
