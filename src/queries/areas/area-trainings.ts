import * as O from 'fp-ts/Option';
import {DateTime} from 'luxon';
import {Equipment} from '../../read-models/shared-state/return-types';

type AreaTrainingSummary = {
  lastTrainingAt: O.Option<Date>;
  trainingsThisMonth: number;
};

// Aggregate the training completions (members trained on this area's equipment)
// into "when was the most recent training" and "how many happened so far this
// calendar month". Pure - derived from data already on the area view model.
export const summariseAreaTrainings = (
  equipment: ReadonlyArray<Equipment>,
  now: DateTime
): AreaTrainingSummary => {
  const trainedAt = equipment.flatMap(item =>
    item.trainedMembers.map(member => member.trainedSince)
  );

  const lastTrainingAt =
    trainedAt.length === 0
      ? O.none
      : O.some(
          trainedAt.reduce((latest, date) =>
            date.getTime() > latest.getTime() ? date : latest
          )
        );

  const trainingsThisMonth = trainedAt.filter(date =>
    DateTime.fromJSDate(date).hasSame(now, 'month')
  ).length;

  return {lastTrainingAt, trainingsThisMonth};
};
