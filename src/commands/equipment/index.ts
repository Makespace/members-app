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
  addNameAlias: {
    ...addNameAlias,
    ...addNameAliasForm,
  },
  removeNameAlias,
};
