import {Equipment} from '../../read-models/shared-state/return-types';
import {User} from '../../types';

export type ViewModel = {
  user: User;
  isSuperUserOrOwnerOfArea: boolean;
  isSuperUserOrTrainerOfArea: boolean;
  equipment: Equipment;
};
