import {User} from '../../types';
import {Equipment} from '../../read-models/equipment/get';
import { TrainingQuizResults } from '../../read-models/shared-state/training-results';

export type ViewModel = {
  user: User;
  isSuperUserOrOwnerOfArea: boolean;
  isSuperUserOrTrainerOfArea: boolean;
  equipment: Equipment;
  trainingQuizResults: TrainingQuizResults;
};
