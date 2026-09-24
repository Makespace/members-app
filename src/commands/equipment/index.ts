import {add} from './add';
import {addForm} from './add-form';
import {registerTrainingSheet} from './register-training-sheet';
import {registerTrainingSheetForm} from './register-training-sheet-form';
import {removeTrainingSheet} from './remove-training-sheet';
import {removeTrainingSheetForm} from './remove-training-sheet-form';
import {markEquipmentObsolete} from './mark-obsolete';
import {markEquipmentObsoleteForm} from './mark-obsolete-form';
import {addNameAlias} from './add-name-alias';
import {addNameAliasForm} from './add-name-alias-form';
import {removeNameAlias} from './remove-name-alias';
import {setCategory} from './set-category';
import {setMachines} from './set-machines';
import {setGuideUrl} from './set-guide-url';
import {setMachinesForm} from './set-machines-form';

export const equipment = {
  add: {
    ...add,
    ...addForm,
  },
  trainingSheet: {
    ...registerTrainingSheet,
    ...registerTrainingSheetForm,
  },
  removeTrainingSheet: {
    ...removeTrainingSheet,
    ...removeTrainingSheetForm,
  },
  markObsolete: {
    ...markEquipmentObsolete,
    ...markEquipmentObsoleteForm,
  },
  setCategory,
  setMachines: {...setMachines, ...setMachinesForm},
  setGuideUrl,
  addNameAlias: {
    ...addNameAlias,
    ...addNameAliasForm,
  },
  removeNameAlias,
};
