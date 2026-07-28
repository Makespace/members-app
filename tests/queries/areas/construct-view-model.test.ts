import {faker} from '@faker-js/faker';
import {advanceTo, clear} from 'jest-date-mock';
import {pipe} from 'fp-ts/lib/function';
import {arbitraryUser} from '../../types/user.helper';
import {getLeftOrFail, getRightOrFail} from '../../helpers';
import * as T from 'fp-ts/Task';
import {constructViewModel} from '../../../src/queries/areas/construct-view-model';
import {
  initTestFramework,
  TestFramework,
} from '../../read-models/test-framework';
import {EmailAddress} from '../../../src/types';
import {Int} from 'io-ts';
import {NonEmptyString, UUID} from 'io-ts-types';

describe('construct-view-model', () => {
  let framework: TestFramework;
  beforeEach(async () => {
    framework = await initTestFramework();
  });
  afterEach(() => {
    clear();
    framework.close();
  });

  const unregisteredUser = arbitraryUser();
  const unprivilegedUser = arbitraryUser();
  const superUser = arbitraryUser();
  beforeEach(async () => {
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: unprivilegedUser.memberNumber,
      email: unprivilegedUser.emailAddress,
      name: undefined,
      formOfAddress: undefined,
    });
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: superUser.memberNumber,
      email: superUser.emailAddress,
      name: undefined,
      formOfAddress: undefined,
    });
    await framework.commands.superUser.declare({
      memberNumber: superUser.memberNumber,
    });
  });

  it('succeeds if the logged in user is a super user', async () => {
    const result = await pipe(
      superUser,
      constructViewModel(framework.sharedReadModel, framework.extDB),
      T.map(getRightOrFail)
    )();
    expect(result.areas).toBeDefined();
    expect(result.canManageAreas).toStrictEqual(true);
    expect(result.canSeeOwnerPrivateDetails).toStrictEqual(true);
  });

  it('succeeds if the logged in user is not a super user', async () => {
    const result = await pipe(
      unprivilegedUser,
      constructViewModel(framework.sharedReadModel, framework.extDB),
      T.map(getRightOrFail)
    )();
    expect(result.areas).toBeDefined();
    expect(result.canManageAreas).toStrictEqual(false);
    expect(result.canSeeOwnerPrivateDetails).toStrictEqual(false);
  });

  it('adds per-equipment training counts for the last four quarters', async () => {
    advanceTo(new Date('2026-07-22T12:00:00.000Z'));
    const area = {
      id: faker.string.uuid() as UUID,
      name: 'Laser Area' as NonEmptyString,
    };
    const equipment = {
      id: faker.string.uuid() as UUID,
      name: 'Laser Cutter' as NonEmptyString,
      areaId: area.id,
    };
    const trainer = {
      memberNumber: faker.number.int(),
      email: faker.internet.email() as EmailAddress,
      name: undefined,
      formOfAddress: undefined,
    };
    const q1Trainee = {
      memberNumber: faker.number.int(),
      email: faker.internet.email() as EmailAddress,
      name: undefined,
      formOfAddress: undefined,
    };
    const q3Trainee = {
      memberNumber: faker.number.int(),
      email: faker.internet.email() as EmailAddress,
      name: undefined,
      formOfAddress: undefined,
    };
    const oldTrainee = {
      memberNumber: faker.number.int(),
      email: faker.internet.email() as EmailAddress,
      name: undefined,
      formOfAddress: undefined,
    };

    await framework.commands.memberNumbers.linkNumberToEmail(trainer);
    await framework.commands.memberNumbers.linkNumberToEmail(q1Trainee);
    await framework.commands.memberNumbers.linkNumberToEmail(q3Trainee);
    await framework.commands.memberNumbers.linkNumberToEmail(oldTrainee);
    await framework.commands.area.create({
      ...area,
      actor: {tag: 'user', user: superUser},
    });
    await framework.commands.equipment.add({
      ...equipment,
      actor: {tag: 'user', user: superUser},
    });
    await framework.commands.trainers.markMemberTrainedBy({
      equipmentId: equipment.id,
      trainedByMemberNumber: trainer.memberNumber as Int,
      trainedAt: new Date('2026-02-03T12:00:00.000Z'),
      memberNumber: q1Trainee.memberNumber as Int,
      actor: {tag: 'user', user: superUser},
    });
    await framework.commands.trainers.markMemberTrainedBy({
      equipmentId: equipment.id,
      trainedByMemberNumber: trainer.memberNumber as Int,
      trainedAt: new Date('2026-07-03T12:00:00.000Z'),
      memberNumber: q3Trainee.memberNumber as Int,
      actor: {tag: 'user', user: superUser},
    });
    await framework.commands.trainers.markMemberTrainedBy({
      equipmentId: equipment.id,
      trainedByMemberNumber: trainer.memberNumber as Int,
      trainedAt: new Date('2025-06-03T12:00:00.000Z'),
      memberNumber: oldTrainee.memberNumber as Int,
      actor: {tag: 'user', user: superUser},
    });

    const result = await pipe(
      superUser,
      constructViewModel(framework.sharedReadModel, framework.extDB),
      T.map(getRightOrFail)
    )();

    expect(
      result.areas[0].equipment[0].trainingsByQuarter.map(q => q.count)
    ).toStrictEqual([0, 1, 0, 1]);
  });

  it("fails if the logged in user isn't known to the shared state", async () => {
    const result = await pipe(
      unregisteredUser,
      constructViewModel(framework.sharedReadModel, framework.extDB),
      T.map(getLeftOrFail)
    )();
    expect(result.status).toStrictEqual(401);
  });
});
