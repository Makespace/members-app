import {faker} from '@faker-js/faker';
import {DateTime} from 'luxon';
import {TestFramework, initTestFramework} from '../test-framework';
import {NonEmptyString, UUID} from 'io-ts-types';

import {EmailAddress} from '../../../src/types';
import {Int} from 'io-ts';
import {getRightOrFail, getSomeOrFail} from '../../helpers';
import {
  FullQuizResultsForEquipment,
  FullQuizResultsForMember,
  getFullQuizResultsForEquipment,
  getFullQuizResultsForMember,
} from '../../../src/read-models/external-state/equipment-quiz';
import {storeSync} from '../../../src/sync-worker/db/store_sync';

// The events column is a second-precision timestamp, so seed whole seconds to
// keep exact-Date assertions stable.
const recentDate = DateTime.now().minus({months: 1}).startOf('second').toJSDate();
const oldDate = DateTime.now().minus({months: 18}).startOf('second').toJSDate();

const runGetQuizResultsByEquipment = async (
  framework: TestFramework,
  trainingSheetId: string,
  equipmentId: UUID
): Promise<FullQuizResultsForEquipment> =>
  getRightOrFail(
    await getFullQuizResultsForEquipment(
      {
        sharedReadModel: framework.sharedReadModel,
        lastQuizSync: framework.lastSync,
      },
      trainingSheetId,
      getSomeOrFail(framework.sharedReadModel.equipment.get(equipmentId))
    )()
  );

const runGetQuizResultsByMemberNumber = async (
  framework: TestFramework,
  memberNumber: number
): Promise<FullQuizResultsForMember> =>
  getRightOrFail(
    await getFullQuizResultsForMember(
      {sharedReadModel: framework.sharedReadModel},
      memberNumber
    )()
  );

describe('Get equipment quiz', () => {
  let framework: TestFramework;
  const addTrainedMember = {
    memberNumber: faker.number.int({max: 100000}) as Int,
    email: faker.internet.email() as EmailAddress,
    name: undefined,
    formOfAddress: undefined,
  };
  const addAwaitingTrainingMember = {
    memberNumber: faker.number.int({max: 100000}) as Int,
    email: faker.internet.email() as EmailAddress,
    name: undefined,
    formOfAddress: undefined,
  };
  // A member number recorded on a quiz row but never linked to an account.
  const unknownMemberNumber = 999999;
  const unknownMemberEmail = faker.internet.email();

  const createArea = {
    id: faker.string.uuid() as UUID,
    name: faker.airline.airport().name as NonEmptyString,
  };
  const addEquipment = {
    id: faker.string.uuid() as UUID,
    name: faker.science.chemicalElement().name as NonEmptyString,
    areaId: createArea.id,
  };
  const markTrained = {
    equipmentId: addEquipment.id,
    memberNumber: addTrainedMember.memberNumber,
  };
  const addTrainingSheet = {
    equipmentId: addEquipment.id,
    trainingSheetId: 'testTrainingSheetId',
  };

  const recordQuiz = (opts: {
    completedAt: Date;
    memberNumber: number | null;
    email: string | null;
    score: number;
    maxScore: number;
  }) =>
    framework.commands.trainingQuiz.record({
      trainingSheetId: addTrainingSheet.trainingSheetId as NonEmptyString,
      completedAt: opts.completedAt,
      memberNumberProvided: opts.memberNumber,
      emailProvided: opts.email,
      score: opts.score as Int,
      maxScore: opts.maxScore as Int,
      rowHash: faker.string.uuid() as NonEmptyString,
    });

  const quizSyncDate = DateTime.now().startOf('second').toJSDate();

  beforeEach(async () => {
    framework = await initTestFramework();
    await framework.commands.memberNumbers.linkNumberToEmail(addTrainedMember);
    await framework.commands.memberNumbers.linkNumberToEmail(
      addAwaitingTrainingMember
    );
    await framework.commands.area.create(createArea);
    await framework.commands.equipment.add(addEquipment);
    await framework.commands.trainers.markTrained(markTrained);
    await framework.commands.equipment.trainingSheet(addTrainingSheet);

    // Trained member: passed -> excluded from "awaiting".
    await recordQuiz({
      completedAt: recentDate,
      memberNumber: addTrainedMember.memberNumber,
      email: addTrainedMember.email,
      score: 10,
      maxScore: 10,
    });
    // Awaiting member: passed (recent) + a passed row older than 12 months +
    // a failed attempt.
    await recordQuiz({
      completedAt: recentDate,
      memberNumber: addAwaitingTrainingMember.memberNumber,
      email: addAwaitingTrainingMember.email,
      score: 10,
      maxScore: 10,
    });
    await recordQuiz({
      completedAt: oldDate,
      memberNumber: addAwaitingTrainingMember.memberNumber,
      email: addAwaitingTrainingMember.email,
      score: 10,
      maxScore: 10,
    });
    await recordQuiz({
      completedAt: recentDate,
      memberNumber: addAwaitingTrainingMember.memberNumber,
      email: addAwaitingTrainingMember.email,
      score: 5,
      maxScore: 10,
    });
    // Unknown member: passed but the member number isn't linked to an account.
    await recordQuiz({
      completedAt: recentDate,
      memberNumber: unknownMemberNumber,
      email: unknownMemberEmail,
      score: 10,
      maxScore: 10,
    });

    // Only used to populate lastQuizSync (the sheet still syncs).
    getRightOrFail(
      await storeSync(framework.extDB)(
        addTrainingSheet.trainingSheetId,
        quizSyncDate
      )()
    );
  });

  afterEach(() => {
    framework.close();
  });

  describe('getFullQuizResultsForEquipment', () => {
    let results: FullQuizResultsForEquipment;
    beforeEach(async () => {
      results = await runGetQuizResultsByEquipment(
        framework,
        addTrainingSheet.trainingSheetId,
        addTrainingSheet.equipmentId
      );
    });

    it('shows the linked, untrained member as awaiting training (once - the >12mo pass is windowed out)', () => {
      expect(results.membersAwaitingTraining.map(m => m.memberNumber)).toStrictEqual(
        [addAwaitingTrainingMember.memberNumber]
      );
      expect(getSomeOrFail(results.lastQuizSync)).toStrictEqual(quizSyncDate);
    });

    it('shows the passed-but-unlinked member as an unknown awaiting pass', () => {
      expect(results.unknownMembersAwaitingTraining).toHaveLength(1);
      expect(
        getSomeOrFail(results.unknownMembersAwaitingTraining[0].memberNumberProvided)
      ).toBe(unknownMemberNumber);
      expect(
        getSomeOrFail(results.unknownMembersAwaitingTraining[0].emailProvided)
      ).toBe(unknownMemberEmail);
      expect(results.unknownMembersAwaitingTraining[0].waitingSince).toStrictEqual(
        recentDate
      );
    });

    it('reports failed quizes with a computed percentage', () => {
      expect(results.failedQuizes).toHaveLength(1);
      expect(results.failedQuizes[0]).toMatchObject({
        score: 5,
        maxScore: 10,
        percentage: 50,
        completedAt: recentDate,
      });
    });
  });

  describe('getFullQuizResultsForMember', () => {
    it('shows the trained member as having passed once', async () => {
      const r = await runGetQuizResultsByMemberNumber(
        framework,
        addTrainedMember.memberNumber
      );
      expect(r.equipmentQuiz[addEquipment.id].passedAt).toStrictEqual([recentDate]);
      expect(r.equipmentQuiz[addEquipment.id].attempted).toHaveLength(0);
    });

    it('is unwindowed - the awaiting member shows both the recent and the >12mo pass', async () => {
      const r = await runGetQuizResultsByMemberNumber(
        framework,
        addAwaitingTrainingMember.memberNumber
      );
      const passedAt = r.equipmentQuiz[addEquipment.id].passedAt;
      expect(passedAt).toHaveLength(2);
      expect(passedAt.map(d => d.getTime())).toEqual(
        expect.arrayContaining([recentDate.getTime(), oldDate.getTime()])
      );
    });

    it('shows the awaiting member’s failed attempt with score/percentage', async () => {
      const r = await runGetQuizResultsByMemberNumber(
        framework,
        addAwaitingTrainingMember.memberNumber
      );
      const attempted = r.equipmentQuiz[addEquipment.id].attempted;
      expect(attempted).toHaveLength(1);
      expect(attempted[0]).toMatchObject({
        score: 5,
        max_score: 10,
        percentage: 50,
        response_submitted: recentDate,
      });
    });
  });
});
