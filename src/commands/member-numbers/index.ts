import {linkNumberToEmail} from './link-number-to-email';
import {linkNumberToEmailForm} from './link-number-to-email-form';

export const memberNumbers = {
  linkNumberToEmail: {
    ...linkNumberToEmail,
    ...linkNumberToEmailForm,
  },
};
