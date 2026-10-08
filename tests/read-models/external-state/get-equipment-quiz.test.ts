import {faker} from '@faker-js/faker';
import {DateTime} from 'luxon';
import {TestFramework, initTestFramework} from '../test-framework';
import {NonEmptyString, UUID} from 'io-ts-types';

import {EmailAddress} from '../../../src/types';
import {Int} from 'io-ts';
import {getRightOrFail, getSomeOrFail, insertRecurlySubscription, countExternalStatements} from '../../helpers';
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
        extDB: framework.extDB,
        logger: framework.depsForCommands.logger,
      },
      trainingSheetId,
      getSomeOrFail(framework.sharedReadModel.equipment.get(equipmentId))
    )()
  );

// A Recurly cache that fails every read, to prove the queue degrades to
// unfiltered rather than erroring the whole page.
const runGetQuizResultsWithBrokenRecurly = async (
  framework: TestFramework,
  trainingSheetId: string,
  equipmentId: UUID
): Promise<FullQuizResultsForEquipment> =>
  getRightOrFail(
    await getFullQuizResultsForEquipment(
      {
        sharedReadModel: framework.sharedReadModel,
        lastQuizSync: framework.lastSync,
        extDB: new Proxy({} as TestFramework['extDB'], {
          get: () => {
            throw new Error('Recurly cache unavailable');
          },
        }),
        logger: framework.depsForCommands.logger,
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

    // Known members must have an active (or absent) Recurly status to stay
    // on the waiting list; make the awaiting member explicitly active.
    await insertRecurlySubscription(framework.extDB, {
      email: addAwaitingTrainingMember.email,
      hasActiveSubscription: true,
    });
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

    // Retaking the quiz does not reset how long someone has been waiting:
    // the list is a queue, so their place is set by the earliest pass.
    it('counts a member who passed twice only once, waiting since the earliest pass', async () => {
      const laterDate = DateTime.now()
        .minus({weeks: 1})
        .startOf('second')
        .toJSDate();
      await recordQuiz({
        completedAt: laterDate,
        memberNumber: addAwaitingTrainingMember.memberNumber,
        email: addAwaitingTrainingMember.email,
        score: 10,
        maxScore: 10,
      });

      const after = await runGetQuizResultsByEquipment(
        framework,
        addTrainingSheet.trainingSheetId,
        addTrainingSheet.equipmentId
      );

      expect(after.membersAwaitingTraining).toHaveLength(1);
      expect(after.membersAwaitingTraining[0].waitingSince).toStrictEqual(
        recentDate
      );
    });

    it('excludes a waiting member whose Recurly subscription is inactive', async () => {
      const inactiveMember = {
        memberNumber: faker.number.int({max: 100000}) as Int,
        email: faker.internet.email() as EmailAddress,
        name: undefined,
        formOfAddress: undefined,
      };
      await framework.commands.memberNumbers.linkNumberToEmail(inactiveMember);
      await recordQuiz({
        completedAt: recentDate,
        memberNumber: inactiveMember.memberNumber,
        email: inactiveMember.email,
        score: 10,
        maxScore: 10,
      });
      await insertRecurlySubscription(framework.extDB, {
        email: inactiveMember.email,
        hasActiveSubscription: false,
      });

      const after = await runGetQuizResultsByEquipment(
        framework,
        addTrainingSheet.trainingSheetId,
        addTrainingSheet.equipmentId
      );

      expect(after.membersAwaitingTraining.map(m => m.memberNumber)).toStrictEqual(
        [addAwaitingTrainingMember.memberNumber]
      );
      // The unknown pass stays: there is no account to attach a status to.
      expect(after.unknownMembersAwaitingTraining).toHaveLength(1);
    });

    // A member can be known to Recurly under a different email than the one
    // they use in the app; the account code is what ties the two together.
    // Without account-code matching this member would read as "no data" and
    // stay in the queue even though Recurly positively says inactive.
    it('excludes a waiting member matched to an inactive subscription only by account code', async () => {
      const mismatchedMember = {
        memberNumber: faker.number.int({max: 100000}) as Int,
        email: faker.internet.email() as EmailAddress,
        name: undefined,
        formOfAddress: undefined,
      };
      const recurlyBillingEmail = faker.internet.email() as EmailAddress;
      await framework.commands.memberNumbers.linkNumberToEmail(mismatchedMember);
      await recordQuiz({
        completedAt: recentDate,
        memberNumber: mismatchedMember.memberNumber,
        email: mismatchedMember.email,
        score: 10,
        maxScore: 10,
      });
      // The Recurly account bills a different address; the account code is
      // the member's app email.
      await insertRecurlySubscription(framework.extDB, {
        email: recurlyBillingEmail,
        hasActiveSubscription: false,
        accountCode: mismatchedMember.email,
      });

      const after = await runGetQuizResultsByEquipment(
        framework,
        addTrainingSheet.trainingSheetId,
        addTrainingSheet.equipmentId
      );

      expect(after.membersAwaitingTraining.map(m => m.memberNumber)).toStrictEqual(
        [addAwaitingTrainingMember.memberNumber]
      );
    });

    // A stat is not worth taking the equipment page down over: when the
    // Recurly cache cannot be read, the list degrades to unfiltered (everyone
    // stays) rather than erroring - the same rule as a stale cache.
    it('keeps everyone waiting when the Recurly cache cannot be read', async () => {
      const after = await runGetQuizResultsWithBrokenRecurly(
        framework,
        addTrainingSheet.trainingSheetId,
        addTrainingSheet.equipmentId
      );

      expect(after.membersAwaitingTraining.map(m => m.memberNumber)).toStrictEqual(
        [addAwaitingTrainingMember.memberNumber]
      );
      expect(after.unknownMembersAwaitingTraining).toHaveLength(1);
    });

    // The equipment page is one of the busiest in the app: checking the queue
    // against Recurly must not cost one query per waiting member.
    it('checks the whole queue against Recurly in a bounded number of queries', async () => {
      // Three more waiting members, all active, on top of the one from
      // beforeEach.
      for (let i = 0; i < 3; i++) {
        const member = {
          memberNumber: faker.number.int({max: 100000}) as Int,
          email: faker.internet.email() as EmailAddress,
          name: undefined,
          formOfAddress: undefined,
        };
        await framework.commands.memberNumbers.linkNumberToEmail(member);
        await recordQuiz({
          completedAt: recentDate,
          memberNumber: member.memberNumber,
          email: member.email,
          score: 10,
          maxScore: 10,
        });
        await insertRecurlySubscription(framework.extDB, {
          email: member.email,
          hasActiveSubscription: true,
        });
      }

      const {result, queryCount} = await countExternalStatements(
        framework.extDBClient,
        async () =>
          getRightOrFail(
            await getFullQuizResultsForEquipment(
              {
                sharedReadModel: framework.sharedReadModel,
                lastQuizSync: framework.lastSync,
                extDB: framework.extDB,
                logger: framework.depsForCommands.logger,
              },
              addTrainingSheet.trainingSheetId,
              getSomeOrFail(
                framework.sharedReadModel.equipment.get(addTrainingSheet.equipmentId)
              )
            )()
          )
      );

      expect(result.membersAwaitingTraining).toHaveLength(4);
      // Bounded regardless of how many members are waiting: one sheet-sync
      // metadata read, one account-codes read, one subscriptions read.
      expect(queryCount).toBeLessThanOrEqual(3);
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
