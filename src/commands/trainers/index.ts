import {addTrainer} from './add-trainer';
import {addTrainerForm} from './add-trainer-form';

export const trainers = {
  add: {
    ...addTrainer,
    ...addTrainerForm,
  },
};
