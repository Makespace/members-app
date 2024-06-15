import {add} from './add';
import {addForm} from './add-form';
import {registerTrainingSheet} from './register-training-sheet';
import {registerTrainingSheetForm} from './register-training-sheet-form';
import {registerTrainingSheetQuizResult} from './register-training-sheet-quiz-result';

export const equipment = {
  add: {
    ...add,
    ...addForm,
  },
  trainingSheet: {
    ...registerTrainingSheet,
    ...registerTrainingSheetForm,
  },
  trainingSheetQuizResult: {
    ...registerTrainingSheetQuizResult,
  },
};
