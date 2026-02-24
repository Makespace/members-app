import {Member} from '../../read-models/shared-state/return-types';
import {User} from '../../types';
import { TrainingMatrix } from '../training-matrix/render';

export type ViewModel = {
  member: Readonly<Member>;
  user: Readonly<User>;
  isSelf: boolean;
  isSuperUser: boolean;
  trainingMatrix: TrainingMatrix;
};
