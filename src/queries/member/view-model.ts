import * as O from 'fp-ts/Option';

import {Member} from '../../read-models/shared-state/return-types';
import {User} from '../../types';
import { TrainingMatrix } from '../shared-render/training-matrix';

export type ViewModel = {
  member: Readonly<Member>;
  user: Readonly<User>;
  isSelf: boolean;
  isSuperUser: boolean;
  trainingMatrix: O.Option<TrainingMatrix>;
};
