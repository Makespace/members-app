import {Member} from '../../read-models/shared-state/return-types';
import { TrainingMatrix } from '../training-matrix/render';

export type ViewModel = {
  member: Readonly<Member>;
  trainingMatrix: TrainingMatrix;
};
