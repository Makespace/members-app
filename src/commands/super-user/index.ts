import {declareForm} from './declare-form';
import {declare} from './declare';
import {revoke} from './revoke';
import {revokeForm} from './revoke-form';

export const superUser = {
  declare: {
    ...declare,
    ...declareForm,
  },
  revoke: {
    ...revoke,
    ...revokeForm,
  },
};
