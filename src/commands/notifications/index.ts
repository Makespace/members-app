import {create} from './create';
import {createForm} from './create-form';
import {dismiss} from './dismiss';
import {dismissForm} from './dismiss-form';
import {revoke} from './revoke';
import {revokeForm} from './revoke-form';

export const notifications = {
  create: {
    ...create,
    ...createForm,
  },
  dismiss: {
    ...dismiss,
    ...dismissForm,
  },
  revoke: {
    ...revoke,
    ...revokeForm,
  },
};
