import {create} from './create';
import {assign} from './assign';
import {resolve} from './resolve';
import {park} from './park';
import {needsHelp} from './needs-help';
import {setEquipment} from './set-equipment';
import {editTitle} from './edit-title';
import {
  assignForm,
  resolveForm,
  needsHelpForm,
  parkForm,
} from './action-form';
import {setEquipmentForm} from './set-equipment-form';

// Actions that own a form/confirmation page combine their command with a Form so they can
// be wired with command() (GET form + POST). create/edit-title stay API-only.
export const troubleTicketCommands = {
  create,
  assign: {...assign, ...assignForm},
  resolve: {...resolve, ...resolveForm},
  park: {...park, ...parkForm},
  needsHelp: {...needsHelp, ...needsHelpForm},
  setEquipment: {...setEquipment, ...setEquipmentForm},
  editTitle,
};
