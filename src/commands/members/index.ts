import {editEmail} from './edit-email';
import {editName} from './edit-name';
import {editNameForm} from './edit-name-form';
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
  signOwnerAgreement: {
    ...signOwnerAgreement,
    ...signOwnerAgreementForm,
  },
};
