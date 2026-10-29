import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {Int} from 'io-ts';
import {NonEmptyString, UUID} from 'io-ts-types';
import {StatusCodes} from 'http-status-codes';
import {DateTime} from 'luxon';
import {Actor} from '../../../src/types/actor';
import {constructViewModel} from '../../../src/queries/equipment-trainings/construct-view-model';
import {constructViewModel as getTrainedViewModel} from '../../../src/queries/equipment-training/construct-view-model';
import {arbitraryUser} from '../../types/user.helper';
import {
  getLeftOrFail,
  getRightOrFail,
  insertRecurlySubscription,
} from '../../helpers';
import {counted} from '../../../src/queries/shared-render/waiting-for-training';
import {constructViewModel as equipmentViewModel} from '../../../src/queries/equipment/construct-view-model';
import {
  initTestFramework,
  TestFramework,
} from '../../read-models/test-framework';

// Who is waiting for training on a machine, as its owners and trainers see it.
describe('waiting for training', () => {
  let framework: TestFramework;
  const areaId = faker.string.uuid() as UUID;
  const bandSaw = faker.string.uuid() as UUID;
  const sheetId = 'band-saw-quiz' as NonEmptyString;
  const trainer = arbitraryUser();
  const owner = arbitraryUser();
  const quizPasser = arbitraryUser();
  const keen = arbitraryUser();
  const trained = arbitraryUser();
  // Whole seconds, as quiz results are recorded to the second.
  const now = new Date(Math.floor(Date.now() / 1000) * 1000);
  const daysAgo = (days: number) =>
    DateTime.fromJSDate(now).minus({days}).toJSDate();

  beforeEach(async () => {
    framework = await initTestFramework();
    await framework.commands.area.create({
      id: areaId,
      name: 'Wood Shop' as NonEmptyString,
    });
    await framework.commands.equipment.add({
      id: bandSaw,
      name: 'Band Saw' as NonEmptyString,
      areaId,
    });
    for (const user of [trainer, owner, quizPasser, keen, trained]) {
      await framework.commands.memberNumbers.linkNumberToEmail({
        memberNumber: user.memberNumber,
        email: user.emailAddress,
        name: undefined,
        formOfAddress: undefined,
      });
    }
    // Trainers are owners who also train, so the trainer is an owner too.
    for (const user of [owner, trainer]) {
      await framework.commands.area.addOwner({
        areaId,
        memberNumber: user.memberNumber,
      });
    }
    await framework.commands.trainers.add({
      equipmentId: bandSaw,
      memberNumber: trainer.memberNumber,
    });
    await framework.commands.equipment.trainingSheet({
      equipmentId: bandSaw,
      trainingSheetId: sheetId,
    });
  });

  afterEach(() => {
    framework.close();
  });

  const passQuiz = (memberNumber: number, completedAt: Date) =>
    framework.commands.trainingQuiz.record({
      trainingSheetId: sheetId,
      completedAt,
      memberNumberProvided: memberNumber,
      emailProvided: null,
      score: 5 as Int,
      maxScore: 5 as Int,
      rowHash: faker.string.alphanumeric(64) as NonEmptyString,
    });

  // Straight into the log, so when it was said can be chosen.
  const sayInterested = (memberNumber: number, at: Date) =>
    framework.depsForCommands.commitEvent(
      framework.sharedReadModel.getCurrentEventIndex()
    )({
      type: 'TrainingInterestExpressed',
      equipmentId: bandSaw,
      memberNumber,
      actor: {tag: 'system'},
      recordedAt: at,
    })();

  const page = async (user = trainer) =>
    getRightOrFail(
      await constructViewModel(framework.depsForCommands, user, now)(bandSaw)()
    );

  it('lists who passed the quiz or said so, longest waiting first, leaving out the trained', async () => {
    await passQuiz(quizPasser.memberNumber, daysAgo(40));
    await sayInterested(keen.memberNumber, daysAgo(60));
    await sayInterested(keen.memberNumber, daysAgo(2));
    await passQuiz(trained.memberNumber, daysAgo(90));
    await framework.commands.trainers.markTrained({
      equipmentId: bandSaw,
      memberNumber: trained.memberNumber as Int,
    });

    const {waiting} = await page();

    expect(
      waiting.map(member => ({
        memberNumber: member.memberNumber,
        waitingSince: member.waitingSince,
        passedQuiz: member.passedQuiz,
        lastExpressedInterest: member.lastExpressedInterest,
      }))
    ).toStrictEqual([
      {
        memberNumber: keen.memberNumber,
        waitingSince: daysAgo(60),
        passedQuiz: false,
        lastExpressedInterest: O.some(daysAgo(2)),
      },
      {
        memberNumber: quizPasser.memberNumber,
        waitingSince: daysAgo(40),
        passedQuiz: true,
        lastExpressedInterest: O.none,
      },
    ]);
  });

  it('counts the wait from the quiz when somebody did both', async () => {
    await sayInterested(quizPasser.memberNumber, daysAgo(10));
    await passQuiz(quizPasser.memberNumber, daysAgo(30));

    const [member] = (await page()).waiting;

    expect(member.waitingSince).toStrictEqual(daysAgo(30));
    expect(member.lastExpressedInterest).toStrictEqual(O.some(daysAgo(10)));
  });

  it('says who is already booked on an upcoming training', async () => {
    await sayInterested(keen.memberNumber, daysAgo(5));
    const startsAt = DateTime.fromJSDate(now).plus({days: 3});
    await framework.commands.trainers.arrangeTraining({
      sessionId: faker.string.uuid() as UUID,
      equipmentId: bandSaw,
      startsAt: startsAt.toJSDate(),
      endsAt: startsAt.plus({hours: 2}).toJSDate(),
      spaces: 4,
      description: '',
      attendees: [keen.memberNumber],
      signUpsCloseHoursBefore: 0,
      actor: {tag: 'user', user: trainer},
    });

    expect((await page()).waiting[0].bookedOn).toStrictEqual(
      O.some(startsAt.toJSDate())
    );
  });

  it("is open to the area's owners, who see it without arranging", async () => {
    expect((await page(owner)).canArrange).toBe(false);
    expect((await page(trainer)).canArrange).toBe(true);

    const failure = getLeftOrFail(
      await constructViewModel(framework.depsForCommands, keen, now)(bandSaw)()
    );
    expect(failure.status).toStrictEqual(StatusCodes.FORBIDDEN);
  });

  it("tells a member on the machine's training page when they last said so", async () => {
    const asKeen: Actor = {tag: 'user', user: keen};
    const lastSaid = async () =>
      getRightOrFail(
        await getTrainedViewModel(framework.depsForCommands, keen)(bandSaw)()
      ).interestLastExpressed;

    expect(await lastSaid()).toStrictEqual(O.none);

    await framework.commands.trainingSessions.expressInterest({
      equipmentId: bandSaw,
      actor: asKeen,
    });

    expect(O.isSome(await lastSaid())).toBe(true);
  });

  describe('members Recurly says have lapsed', () => {
    const lapse = (user: typeof keen) =>
      insertRecurlySubscription(framework.extDB, {
        email: user.emailAddress,
        hasActiveSubscription: false,
      });

    const flagged = async () =>
      (await page()).waiting.map(member => [
        member.memberNumber,
        member.inactiveInRecurly,
      ]);

    it('are kept, flagged, whether they passed the quiz or only asked', async () => {
      await passQuiz(quizPasser.memberNumber, daysAgo(40));
      await sayInterested(keen.memberNumber, daysAgo(20));
      await lapse(quizPasser);
      await lapse(keen);

      expect(await flagged()).toStrictEqual([
        [quizPasser.memberNumber, true],
        [keen.memberNumber, true],
      ]);
    });

    it('are not counted', async () => {
      await sayInterested(keen.memberNumber, daysAgo(20));
      await sayInterested(quizPasser.memberNumber, daysAgo(10));
      await lapse(keen);

      expect(
        counted((await page()).waiting).map(member => member.memberNumber)
      ).toStrictEqual([quizPasser.memberNumber]);
    });
  });

  it('counts a quiz pass under a member number nobody has', async () => {
    await passQuiz(987654321, daysAgo(7));

    const [member] = (await page()).waiting;

    expect(member).toMatchObject({
      memberNumber: 987654321,
      noAccount: true,
      inactiveInRecurly: false,
    });
  });

  it("gives the equipment page the same number as the machine's trainings page", async () => {
    await passQuiz(quizPasser.memberNumber, daysAgo(40));
    await sayInterested(keen.memberNumber, daysAgo(20));

    const equipmentPage = getRightOrFail(
      await equipmentViewModel(framework.depsForCommands, owner)(bandSaw)()
    );

    // Said apart: one has done the online training, one only asked.
    expect(equipmentPage.training).toMatchObject({
      doneOnlineTraining: 1,
      askedToBeTrained: 1,
    });
    expect(
      equipmentPage.training.doneOnlineTraining +
        equipmentPage.training.askedToBeTrained
    ).toStrictEqual(counted((await page()).waiting).length);
  });
});
