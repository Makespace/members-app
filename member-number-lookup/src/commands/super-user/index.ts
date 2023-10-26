import {declareForm} from './declare-form';
import {declare} from './declare';

export const superUser = {
  declare: {
    ...declare,
    ...declareForm,
  },
};
