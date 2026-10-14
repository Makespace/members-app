import {addOwner} from './add-owner';
import {addOwnerForm} from './add-owner-form';
import {create} from './create';
import {createForm} from './create-form';
import {removeArea} from './remove-area';
import {removeAreaForm} from './remove-area-form';
import {removeOwner} from './remove-owner';
import {removeOwnerForm} from './remove-owner-form';
import {setMailingList} from './set-mailing-list';
import {setMailingListForm} from './set-mailing-list-form';
import {addNameAlias} from './add-name-alias';
import {addNameAliasForm} from './add-name-alias-form';
import {removeNameAlias} from './remove-name-alias';
import {addEquipmentCategory} from './add-equipment-category';
import {addEquipmentCategoryForm} from './add-equipment-category-form';
import {removeEquipmentCategory} from './remove-equipment-category';
import {removeEquipmentCategoryForm} from './remove-equipment-category-form';
import {setEquipmentCategories} from './set-equipment-categories';
import {setEquipmentCategoriesForm} from './set-equipment-categories-form';


export const area = {
  create: {
    ...create,
    ...createForm,
  },
  addOwner: {
    ...addOwner,
    ...addOwnerForm,
  },
  removeOwner: {
    ...removeOwner,
    ...removeOwnerForm,
  },
  remove: {
    ...removeArea,
    ...removeAreaForm,
  },
  setMailingList: {
    ...setMailingList,
    ...setMailingListForm,
  },
  addNameAlias: {
    ...addNameAlias,
    ...addNameAliasForm,
  },
  removeNameAlias,
  addEquipmentCategory: {
    ...addEquipmentCategory,
    ...addEquipmentCategoryForm,
  },
  removeEquipmentCategory: {
    ...removeEquipmentCategory,
    ...removeEquipmentCategoryForm,
  },
  setEquipmentCategories: {
    ...setEquipmentCategories,
    ...setEquipmentCategoriesForm,
  },
};
