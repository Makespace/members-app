import {declareForm} from './declare-form';
import {declare} from './declare';
import {revoke} from './revoke';

export const superUser = {
  declare: {
    ...declare,
    ...declareForm,
  },
  revoke: {
    ...revoke,
  },
};
