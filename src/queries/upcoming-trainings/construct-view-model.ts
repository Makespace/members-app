import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {User} from '../../types';
import {Dependencies} from '../../dependencies';
import {
  toTrainingSessionView,
  TrainingSessionView,
} from '../shared-render/upcoming-training-sessions';
import {
  readinessFor,
  Readiness,
  trainedSinceFor,
} from '../equipment-training/construct-view-model';

export type UpcomingTraining = {
  equipment: {id: string; name: string; areaName: string};
  session: TrainingSessionView;
  // Already trained on the machine: they may still come for a refresher.
  trained: boolean;
  // Whether anything comes first - other machines, or the quiz. When it
  // does, they are sent to the machine's training page rather than straight
  // to a session.
  readiness: Readiness;
};

export type ViewModel = {
  // Soonest first, on every machine.
  trainings: ReadonlyArray<UpcomingTraining>;
  showingTrained: boolean;
  // How many machines' sessions were left out because the reader is
  // trained on them, when they are being left out.
  hiddenEquipment: number;
};

// Every training arranged in the app that is still to come. A machine since
// taken out of use has nothing left to train anybody on, so its sessions are
// left out rather than offered. By default so are the machines the reader is
// already trained on: they are mostly looking for something new.
export const constructViewModel = (
  deps: Dependencies,
  user: User,
  now: Date,
  showTrained: boolean
): ViewModel => {
  const all: ReadonlyArray<UpcomingTraining> = deps.sharedReadModel.trainingSessions
    .allUpcoming(now)
    .flatMap(session =>
      pipe(
        deps.sharedReadModel.equipment.get(session.equipmentId),
        O.filter(equipment => O.isNone(equipment.removedAt)),
        O.match(
          () => [],
          equipment => {
            const trained = O.isSome(
              trainedSinceFor(deps, user, equipment.id)
            );
            return [
              {
                equipment: {
                  id: equipment.id,
                  name: equipment.name,
                  areaName: equipment.area.name,
                },
                session: toTrainingSessionView(
                  deps.sharedReadModel,
                  equipment,
                  O.some({memberNumber: user.memberNumber, now})
                )(session),
                trained,
                readiness: readinessFor(deps, user, equipment),
              },
            ];
          }
        )
      )
    );
  return {
    trainings: showTrained ? all : all.filter(training => !training.trained),
    showingTrained: showTrained,
    hiddenEquipment: showTrained
      ? 0
      : new Set(
          all
            .filter(training => training.trained)
            .map(training => training.equipment.id)
        ).size,
  };
};
