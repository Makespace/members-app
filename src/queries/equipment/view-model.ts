import {FullQuizResultsForEquipment} from '../../read-models/external-state/equipment-quiz';
import {GuideLinkCheck} from '../../read-models/external-state/guide-links';
import {Equipment} from '../../read-models/shared-state/return-types';
import {User} from '../../types';
import * as O from 'fp-ts/Option';

export type ViewModel = {
  user: User;
  isSuperUserOrOwnerOfArea: boolean;
  isSuperUserOrTrainerOfArea: boolean;
  isSuperUser: boolean;
  equipment: Equipment;
  // What the nightly check found when it last fetched the recorded guide
  // address. None when no address is recorded, or when it has not been
  // checked yet.
  guideLink: O.Option<GuideLinkCheck>;
  quizResults: O.Option<FullQuizResultsForEquipment>;
};
