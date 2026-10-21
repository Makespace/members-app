import {create} from './create';
import {createForm} from './create-form';
import {rename} from './rename';
import {renameForm} from './rename-form';
import {setBudget} from './set-budget';
import {setBudgetForm} from './set-budget-form';
import {assignArea} from './assign-area';
import {assignAreaForm} from './assign-area-form';
import {unassignArea} from './unassign-area';
import {unassignAreaForm} from './unassign-area-form';
import {addPurchaser} from './add-purchaser';
import {addPurchaserForm} from './add-purchaser-form';
import {removePurchaser} from './remove-purchaser';
import {removePurchaserForm} from './remove-purchaser-form';

export const purchasingArea = {
  create: {
    ...create,
    ...createForm,
  },
  rename: {
    ...rename,
    ...renameForm,
  },
  setBudget: {
    ...setBudget,
    ...setBudgetForm,
  },
  assignArea: {
    ...assignArea,
    ...assignAreaForm,
  },
  unassignArea: {
    ...unassignArea,
    ...unassignAreaForm,
  },
  addPurchaser: {
    ...addPurchaser,
    ...addPurchaserForm,
  },
  removePurchaser: {
    ...removePurchaser,
    ...removePurchaserForm,
  },
};
