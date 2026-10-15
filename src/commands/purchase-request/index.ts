import {submit} from './submit';
import {submitForm} from './submit-form';

export const purchaseRequest = {
  submit: {
    ...submit,
    ...submitForm,
  },
};
