import {editEmail} from './edit-email';
import {editName} from './edit-name';
import {editNameForm} from './edit-name-form';
import {editFormOfAddress} from './edit-form-of-address';
import {editFormOfAddressForm} from './edit-form-of-address-form';
import {signOwnerAgreement} from './sign-owner-agreement';
import {signOwnerAgreementForm} from './sign-owner-agreement-form';

export const members = {
  editName: {
    ...editName,
    ...editNameForm,
  },
  editEmail: {
    ...editEmail,
  },
  editFormOfAddress: {
    ...editFormOfAddress,
    ...editFormOfAddressForm,
  },
  signOwnerAgreement: {
    ...signOwnerAgreement,
    ...signOwnerAgreementForm,
  },
};
