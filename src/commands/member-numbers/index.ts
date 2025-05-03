import {linkNumberToEmail} from './link-number-to-email';
import {linkNumberToEmailForm} from './link-number-to-email-form';
import {markMemberRejoinedWithNewNumber} from './mark-member-rejoined-with-new-number';
import {markMemberRejoinedWithNewNumberForm} from './mark-member-rejoined-with-new-number-form';
import {markMemberRejoinedWithExistingNumber} from './mark-member-rejoined-with-existing-number';
import {markMemberRejoinedWithExistingNumberForm} from './mark-member-rejoined-with-existing-number-form';

export const memberNumbers = {
  linkNumberToEmail: {
    ...linkNumberToEmail,
    ...linkNumberToEmailForm,
  },
  markMemberRejoinedWithNewNumber: {
    ...markMemberRejoinedWithNewNumber,
    ...markMemberRejoinedWithNewNumberForm,
  },
  markMemberRejoinedWithExistingNumber: {
    ...markMemberRejoinedWithExistingNumber,
    ...markMemberRejoinedWithExistingNumberForm,
  },
};
