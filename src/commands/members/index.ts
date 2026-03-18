import {editName} from './edit-name';
import {editNameForm} from './edit-name-form';
import {editFormOfAddress} from './edit-form-of-address';
import {editFormOfAddressForm} from './edit-form-of-address-form';
import {signOwnerAgreement} from './sign-owner-agreement';
import {signOwnerAgreementForm} from './sign-owner-agreement-form';
import {addEmail} from './add-email';
import {changePrimaryEmail} from './change-primary-email';
import {sendEmailVerification} from './send-email-verification';
import {verifyEmail} from './verify-email';
import {addEmailForm} from './add-email-form';
import {changePrimaryEmailForm} from './change-primary-email-form';
import {sendEmailVerificationForm} from './send-email-verification-form';

export const members = {
  editName: {
    ...editName,
    ...editNameForm,
  },
  editFormOfAddress: {
    ...editFormOfAddress,
    ...editFormOfAddressForm,
  },
  signOwnerAgreement: {
    ...signOwnerAgreement,
    ...signOwnerAgreementForm,
  },
  addEmail: {
    ...addEmail,
    ...addEmailForm,
  },
  changePrimaryEmail: {
    ...changePrimaryEmail,
    ...changePrimaryEmailForm,
  },
  sendEmailVerification: {
    ...sendEmailVerification,
    ...sendEmailVerificationForm,
  },
  verifyEmail: {
    ...verifyEmail,
  }
};
