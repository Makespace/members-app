import {FullQuizResultsForEquipment} from '../../read-models/external-state/equipment-quiz';
import {GuideLinkCheck} from '../../read-models/external-state/guide-links';
import {Equipment} from '../../read-models/shared-state/return-types';
import {User} from '../../types';
import * as O from 'fp-ts/Option';
import {TrainingSessionView} from '../shared-render/upcoming-training-sessions';

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
  // What the two cards at the top of the page say: enough to know whether
  // anything needs doing without opening either of them.
  // Counted over a rolling thirty days, so the numbers do not fall off a
  // cliff on the first of the month.
  tickets: {active: number; resolvedRecently: number};
  training: {
    activeTrainers: number;
    trainingsRecently: number;
    // Not yet trained, and not known-lapsed in Recurly: those who passed the
    // quiz (the online training), and those who only asked the trainers.
    // From the same list as the machine's trainings page, so they agree.
    doneOnlineTraining: number;
    askedToBeTrained: number;
  };
  // Only the machine's own trainers can arrange a training on it; being a
  // super-user is not enough, because the trainer is whoever arranges it.
  isTrainer: boolean;
  upcomingTrainings: ReadonlyArray<TrainingSessionView>;
};
