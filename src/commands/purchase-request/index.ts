import {submit} from './submit';
import {submitForm} from './submit-form';
import {approve} from './approve';
import {approveForm} from './approve-form';
import {decline} from './decline';
import {declineForm} from './decline-form';

export const purchaseRequest = {
  submit: {
    ...submit,
    ...submitForm,
  },
  approve: {
    ...approve,
    ...approveForm,
  },
  decline: {
    ...decline,
    ...declineForm,
  },
};
