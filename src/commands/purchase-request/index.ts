import {submit} from './submit';
import {submitForm} from './submit-form';
import {approve} from './approve';
import {approveForm} from './approve-form';
import {decline} from './decline';
import {declineForm} from './decline-form';
import {markBought} from './mark-bought';
import {markBoughtForm} from './mark-bought-form';
import {markInvoiceSent} from './mark-invoice-sent';
import {markInvoiceSentForm} from './mark-invoice-sent-form';

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
  markBought: {
    ...markBought,
    ...markBoughtForm,
  },
  markInvoiceSent: {
    ...markInvoiceSent,
    ...markInvoiceSentForm,
  },
};
