import * as O from 'fp-ts/Option';
import {DateTime} from 'luxon';
import {summariseAreaTrainings} from '../../../src/queries/areas/area-trainings';
import {Equipment} from '../../../src/read-models/shared-state/return-types';

// summariseAreaTrainings only reads trainedMembers[].trainedSince.
const equipmentTrainedOn = (dates: ReadonlyArray<Date>): Equipment =>
  ({
    trainedMembers: dates.map(trainedSince => ({trainedSince})),
  } as unknown as Equipment);

const now = DateTime.fromJSDate(new Date('2026-07-20T12:00:00.000Z'));

describe('summariseAreaTrainings', () => {
  it('reports no last training and zero this month when there are none', () => {
    const {lastTrainingAt, trainingsThisMonth} = summariseAreaTrainings(
      [equipmentTrainedOn([])],
      now
    );
    expect(lastTrainingAt).toStrictEqual(O.none);
    expect(trainingsThisMonth).toBe(0);
  });

  it('finds the most recent training across all the equipment', () => {
    const a = equipmentTrainedOn([
      new Date('2026-01-01T12:00:00.000Z'),
      new Date('2026-07-05T12:00:00.000Z'),
    ]);
    const b = equipmentTrainedOn([
      new Date('2026-07-18T12:00:00.000Z'),
      new Date('2025-12-30T12:00:00.000Z'),
    ]);

    const {lastTrainingAt} = summariseAreaTrainings([a, b], now);

    expect(lastTrainingAt).toStrictEqual(
      O.some(new Date('2026-07-18T12:00:00.000Z'))
    );
  });

  it('counts only trainings in the current calendar month', () => {
    const equipment = equipmentTrainedOn([
      new Date('2026-07-02T12:00:00.000Z'), // this month
      new Date('2026-07-19T12:00:00.000Z'), // this month
      new Date('2026-06-15T12:00:00.000Z'), // previous month
      new Date('2025-07-15T12:00:00.000Z'), // same month, previous year
    ]);

    const {trainingsThisMonth} = summariseAreaTrainings([equipment], now);

    expect(trainingsThisMonth).toBe(2);
  });
});
