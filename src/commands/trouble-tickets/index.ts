import {record} from './record';
import {raise} from './raise';
import {raiseForm} from './raise-form';
import {create} from './create';
import {assign} from './assign';
import {assignTo} from './assign-to';
import {invite} from './invite';
import {declineInvitation} from './decline-invitation';
import {resolve} from './resolve';
import {park} from './park';
import {needsHelp} from './needs-help';
import {setEquipment} from './set-equipment';
import {editTitle} from './edit-title';
import {
  assignForm,
  assignToForm,
  inviteForm,
  declineInvitationForm,
  resolveForm,
  needsHelpForm,
  parkForm,
} from './action-form';

// Actions that own a confirmation page combine their command with a Form so
// they can be wired with command() (GET form + POST). record is the ingest
// path; create/set-equipment/edit-title stay API-only.
export const troubleTickets = {
  record,
  raise: {...raise, ...raiseForm},
  create,
  assign: {...assign, ...assignForm},
  assignTo: {...assignTo, ...assignToForm},
  invite: {...invite, ...inviteForm},
  declineInvitation: {...declineInvitation, ...declineInvitationForm},
  resolve: {...resolve, ...resolveForm},
  park: {...park, ...parkForm},
  needsHelp: {...needsHelp, ...needsHelpForm},
  setEquipment,
  editTitle,
};
