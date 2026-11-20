import {create} from './create';
import {createForm} from './create-form';
import {rename} from './rename';
import {renameForm} from './rename-form';
import {setBudget} from './set-budget';
import {setBudgetForm} from './set-budget-form';
import {setSmallPurchaseAmount} from './set-small-purchase-amount';
import {setSmallPurchaseAmountForm} from './set-small-purchase-amount-form';
import {setAllowance} from './set-allowance';
import {setAllowanceForm} from './set-allowance-form';
import {assignArea} from './assign-area';
import {assignAreaForm} from './assign-area-form';
import {unassignArea} from './unassign-area';
import {unassignAreaForm} from './unassign-area-form';
import {addPurchaser} from './add-purchaser';
import {addPurchaserForm} from './add-purchaser-form';
import {removePurchaser} from './remove-purchaser';
import {removePurchaserForm} from './remove-purchaser-form';
import {setYearBudget} from './set-year-budget';
import {setYearBudgetForm} from './set-year-budget-form';
import {setExtension} from './set-extension';
import {setExtensionForm} from './set-extension-form';
import {removeSpend} from './remove-spend';
import {removeSpendForm} from './remove-spend-form';
import {activate, deactivate} from './activation';
import {activateForm, deactivateForm} from './activation-form';
import {remove} from './remove';
import {removeForm} from './remove-form';

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
  setSmallPurchaseAmount: {
    ...setSmallPurchaseAmount,
    ...setSmallPurchaseAmountForm,
  },
  setAllowance: {
    ...setAllowance,
    ...setAllowanceForm,
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
  setExtension: {
    ...setExtension,
    ...setExtensionForm,
  },
  setYearBudget: {
    ...setYearBudget,
    ...setYearBudgetForm,
  },
  removeSpend: {
    ...removeSpend,
    ...removeSpendForm,
  },
  activate: {
    ...activate,
    ...activateForm,
  },
  deactivate: {
    ...deactivate,
    ...deactivateForm,
  },
  remove: {
    ...remove,
    ...removeForm,
  },
};
