import {linkNumberToEmail} from './link-number-to-email';
import {linkNumberToEmailForm} from './link-number-to-email-form';
import {markMemberRejoined} from './mark-member-rejoined';
import {markMemberRejoinedForm} from './mark-member-rejoined-form';

export const memberNumbers = {
  linkNumberToEmail: {
    ...linkNumberToEmail,
    ...linkNumberToEmailForm,
  },
  markMemberRejoined: {
    ...markMemberRejoined,
    ...markMemberRejoinedForm,
  },
};
