import {addTrainer} from '../equipment-trainers/add-trainer';
import {addTrainerForm} from '../equipment-trainers/add-trainer-form';

export const equipmentTrainers = {
  add: {
    ...addTrainer,
    ...addTrainerForm,
  },
};
