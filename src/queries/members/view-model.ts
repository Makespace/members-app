import { RecurlyStatus } from '../../read-models/external-state/recurly-status';
import {MemberCoreInfo} from '../../read-models/shared-state/return-types';

export type ViewModel = {
  members: ReadonlyArray<MemberCoreInfo & {recurlyStatus: RecurlyStatus}>;
};
