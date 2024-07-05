import {FailedLinking} from '../../read-models/members';
import {User} from '../../types';

export type ViewModel = {
  failedImports: ReadonlyArray<FailedLinking>;
  user: User;
};
