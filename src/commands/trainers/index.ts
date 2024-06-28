import {addTrainer} from './add-trainer';
import {addTrainerForm} from './add-trainer-form';

import {markMemberTrained} from './mark-member-trained';
import {markMemberTrainedForm} from './mark-member-trained-form';

export const trainers = {
  add: {
    ...addTrainer,
    ...addTrainerForm,
  },
  markTrained: {
    ...markMemberTrained,
    ...markMemberTrainedForm,
  },
};
