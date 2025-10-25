import {addTrainer} from './add-trainer';
import {addTrainerForm} from './add-trainer-form';

import {markMemberTrained} from './mark-member-trained';
import {markMemberTrainedBy} from './mark-member-trained-by';
import {markMemberTrainedByForm} from './mark-member-trained-by-form';
import {markMemberTrainedForm} from './mark-member-trained-form';
import {revokeMemberTrained} from './revoke-member-trained';
import {revokeMemberTrainedForm} from './revoke-member-trained-form';

export const trainers = {
  add: {
    ...addTrainer,
    ...addTrainerForm,
  },
  markTrained: {
    ...markMemberTrained,
    ...markMemberTrainedForm,
  },
  revokeTrained: {
    ...revokeMemberTrained,
    ...revokeMemberTrainedForm,
  },
  markMemberTrainedBy: {
    ...markMemberTrainedBy,
    ...markMemberTrainedByForm,
  },
};
