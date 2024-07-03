import {FailedLinking} from '../../read-models/members';

export type ViewModel = {
  viewerIsSuperUser: boolean;
  failedImports: ReadonlyArray<FailedLinking>;
};
