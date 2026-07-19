import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';
import {Int} from 'io-ts';
import {DateTime} from 'luxon';
import {EmailAddress} from '../../../../src/types';
import {
  trainingsByQuarter,
  trainingsDeliveredBy,
} from '../../../../src/read-models/shared-state/member/training-delivered';
import {TestFramework, initTestFramework} from '../../test-framework';

describe('trainingsByQuarter', () => {
  // Fixed "now" in Q3 2026; the last 4 quarters are Q4 2025 .. Q3 2026.
  const now = DateTime.fromISO('2026-07-19T12:00:00Z');
  const at = (iso: string) => DateTime.fromISO(iso).toJSDate();

  it('returns the last 4 quarters oldest-first, all zero for no deliveries', () => {
    const result = trainingsByQuarter([], now);
    expect(result.map(q => q.label)).toStrictEqual([
      'Q4 2025',
      'Q1 2026',
      'Q2 2026',
      'Q3 2026',
    ]);
    expect(result.map(q => q.count)).toStrictEqual([0, 0, 0, 0]);
  });

  it('counts deliveries into the correct quarter', () => {
    const result = trainingsByQuarter(
      [
        at('2025-11-15T10:00:00Z'), // Q4 2025
        at('2026-05-15T10:00:00Z'), // Q2 2026
        at('2026-07-10T10:00:00Z'), // Q3 2026
        at('2026-07-12T10:00:00Z'), // Q3 2026
      ],
      now
    );
    expect(result.map(q => q.count)).toStrictEqual([1, 0, 1, 2]);
  });

  it('ignores deliveries older than the window', () => {
    const result = trainingsByQuarter([at('2025-07-15T10:00:00Z')], now); // Q3 2025
    expect(result.map(q => q.count)).toStrictEqual([0, 0, 0, 0]);
  });
});

describe('trainingsDeliveredBy', () => {
  let framework: TestFramework;

  const trainer = {
    memberNumber: faker.number.int() as Int,
    email: faker.internet.email() as EmailAddress,
  };
  const trainerPastNumber = faker.number.int() as Int;
  const trainee = {
    memberNumber: faker.number.int() as Int,
    email: faker.internet.email() as EmailAddress,
  };
  const trainee2 = {
    memberNumber: faker.number.int() as Int,
    email: faker.internet.email() as EmailAddress,
  };
  const areaId = faker.string.uuid() as UUID;
  const equipmentA = faker.string.uuid() as UUID;
  const equipmentB = faker.string.uuid() as UUID;

  beforeEach(async () => {
    framework = await initTestFramework();
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: trainer.memberNumber,
      email: trainer.email,
      name: undefined,
      formOfAddress: undefined,
    });
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: trainee.memberNumber,
      email: trainee.email,
      name: undefined,
      formOfAddress: undefined,
    });
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: trainee2.memberNumber,
      email: trainee2.email,
      name: undefined,
      formOfAddress: undefined,
    });
    await framework.commands.area.create({
      id: areaId,
      name: faker.airline.airport().name as NonEmptyString,
    });
    await framework.commands.equipment.add({
      id: equipmentA,
      name: 'Lathe' as NonEmptyString,
      areaId,
    });
    await framework.commands.equipment.add({
      id: equipmentB,
      name: 'Mill' as NonEmptyString,
      areaId,
    });
    const actor = {
      tag: 'user' as const,
      user: {emailAddress: trainer.email, memberNumber: trainer.memberNumber},
    };
    await framework.commands.trainers.markMemberTrainedBy({
      equipmentId: equipmentA,
      memberNumber: trainee.memberNumber,
      trainedByMemberNumber: trainer.memberNumber,
      trainedAt: new Date('2026-05-15T10:00:00Z'),
      actor,
    });
    await framework.commands.trainers.markMemberTrainedBy({
      equipmentId: equipmentB,
      memberNumber: trainee.memberNumber,
      trainedByMemberNumber: trainer.memberNumber,
      trainedAt: new Date('2026-06-20T10:00:00Z'),
      actor,
    });
    // Delivered earlier under a past (pre-rejoin) member number.
    await framework.commands.trainers.markMemberTrainedBy({
      equipmentId: equipmentA,
      memberNumber: trainee2.memberNumber,
      trainedByMemberNumber: trainerPastNumber,
      trainedAt: new Date('2026-04-10T10:00:00Z'),
      actor,
    });
  });

  afterEach(() => framework.close());

  const run = (
    memberNumbers: ReadonlyArray<number>,
    equipmentIds: ReadonlyArray<UUID>
  ) =>
    trainingsDeliveredBy(framework.sharedReadModel.db)(
      memberNumbers,
      equipmentIds
    );

  it('returns nothing when no equipment is supplied (short-circuit)', () => {
    expect(run([trainer.memberNumber], [])).toStrictEqual([]);
  });

  it('returns nothing when no member numbers are supplied', () => {
    expect(run([], [equipmentA, equipmentB])).toStrictEqual([]);
  });

  it("scopes to the given area's equipment", () => {
    expect(run([trainer.memberNumber], [equipmentA])).toHaveLength(1);
    expect(run([trainer.memberNumber], [equipmentA, equipmentB])).toHaveLength(
      2
    );
  });

  it('includes trainings delivered under a past member number', () => {
    expect(run([trainer.memberNumber], [equipmentA, equipmentB])).toHaveLength(
      2
    );
    expect(
      run([trainer.memberNumber, trainerPastNumber], [equipmentA, equipmentB])
    ).toHaveLength(3);
  });

  it('does not count trainings delivered by someone else', () => {
    expect(run([trainee.memberNumber], [equipmentA, equipmentB])).toStrictEqual(
      []
    );
  });
});
