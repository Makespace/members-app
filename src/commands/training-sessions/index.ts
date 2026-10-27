import {signUp} from './sign-up';
import {signUpForm} from './sign-up-form';
import {cancelPlace} from './cancel-place';
import {cancelPlaceForm} from './cancel-place-form';
import {cancelSession} from './cancel';
import {cancelForm} from './cancel-form';

export const trainingSessions = {
  signUp: {
    ...signUp,
    ...signUpForm,
  },
  cancelPlace: {
    ...cancelPlace,
    ...cancelPlaceForm,
  },
  cancel: {
    ...cancelSession,
    ...cancelForm,
  },
};
