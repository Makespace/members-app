import {editEmail} from './edit-email';
import {editName} from './edit-name';
import {editNameForm} from './edit-name-form';
import {editPronouns} from './edit-pronouns';
import {editPronounsForm} from './edit-pronouns-form';
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
  editPronouns: {
    ...editPronouns,
    ...editPronounsForm,
  },
  signOwnerAgreement: {
    ...signOwnerAgreement,
    ...signOwnerAgreementForm,
  },
};
