import * as O from 'fp-ts/Option';
import { MemberBilling } from '../../read-models/external-state/recurly-billing';
import { RecurlyStatus } from '../../read-models/external-state/recurly-status';
import {Member} from '../../read-models/shared-state/return-types';
import {User} from '../../types';
import { TrainingMatrix } from '../training-matrix/render';

export type ViewModel = {
  member: Readonly<Member>;
  user: Readonly<User>;
  isSelf: boolean;
  isSuperUser: boolean;
  trainingMatrix: TrainingMatrix;
  recurlyStatus: RecurlyStatus;
  // Only ever populated for a super user. Gated here, at the fetch, rather
  // than in the template: billing detail that never enters the view model
  // cannot be leaked by a later change to the rendering.
  billing: O.Option<MemberBilling>;
};
