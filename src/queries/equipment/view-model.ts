import {EquipmentQuizResults} from '../../read-models/external-state/equipment-quiz';
import {Equipment} from '../../read-models/shared-state/return-types';
import {User} from '../../types';
import * as O from 'fp-ts/Option';

export type ViewModel = {
  user: User;
  isSuperUserOrOwnerOfArea: boolean;
  isSuperUserOrTrainerOfArea: boolean;
  isSuperUser: boolean;
  equipment: Equipment;
  quizResults: O.Option<EquipmentQuizResults>;
};
