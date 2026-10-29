import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';
import {DateTime} from 'luxon';
import {Int} from 'io-ts';
import {Actor} from '../../../src/types/actor';
import {constructViewModel} from '../../../src/queries/upcoming-trainings/construct-view-model';
import {arbitraryUser} from '../../types/user.helper';
import {getRightOrFail} from '../../helpers';
import {meetupTrainingTable} from '../../../src/sync-worker/meetup/meetup-training-table';
import {
  initTestFramework,
  TestFramework,
} from '../../read-models/test-framework';

// The "Get trained" page: every training still to come, on every machine.
describe('upcoming trainings across the space', () => {
  let framework: TestFramework;
  const areaId = faker.string.uuid() as UUID;
  const bandSaw = faker.string.uuid() as UUID;
  const lathe = faker.string.uuid() as UUID;
  const trainer = arbitraryUser();
  const member = arbitraryUser();
  const asTrainer: Actor = {tag: 'user', user: trainer};

  beforeEach(async () => {
    framework = await initTestFramework();
    await framework.commands.area.create({
      id: areaId,
      name: 'Wood Shop' as NonEmptyString,
    });
    for (const [id, name] of [
      [bandSaw, 'Band Saw'],
      [lathe, 'Lathe'],
    ] as const) {
      await framework.commands.equipment.add({
        id,
        name: name as NonEmptyString,
        areaId,
      });
    }
  });

  afterEach(() => {
    framework.close();
  });

  const session = async (
    equipmentId: UUID,
    startsInHours: number,
    attendees: number[] = []
  ) => {
    const sessionId = faker.string.uuid() as UUID;
    const startsAt = DateTime.now().plus({hours: startsInHours});
    await framework.depsForCommands.commitEvent(
      framework.sharedReadModel.getCurrentEventIndex()
    )({
      type: 'TrainingSessionScheduled',
      sessionId,
      equipmentId,
      trainerMemberNumber: trainer.memberNumber,
      startsAt: startsAt.toJSDate(),
      endsAt: startsAt.plus({hours: 2}).toJSDate(),
      spaces: 3,
      description: '',
      attendees,
      signUpsCloseHoursBefore: 0,
      actor: asTrainer,
      recordedAt: new Date(),
    })();
    return sessionId;
  };

  const page = async (showTrained = false, reader = O.some(member)) =>
    getRightOrFail(
      await constructViewModel(
        framework.depsForCommands,
        reader,
        new Date(),
        showTrained
      )()
    );

  const trainings = async () => (await page()).trainings;

  const markTrained = (equipmentId: UUID) =>
    framework.commands.trainers.markTrained({
      equipmentId,
      memberNumber: member.memberNumber as Int,
    });

  describe('equipment the reader is already trained on', () => {
    beforeEach(async () => {
      await linkMember();
      await markTrained(bandSaw);
    });

    it('is left out by default, counted once per machine', async () => {
      await session(bandSaw, 10);
      await session(bandSaw, 30);
      const latheSession = await session(lathe, 20);

      expect((await page()).trainings.map(t => t.session.id)).toStrictEqual([
        latheSession,
      ]);
      expect((await page()).hiddenEquipment).toStrictEqual(1);
    });

    it('is shown when asked for, marked as trained, and still open to sign up', async () => {
      await session(bandSaw, 10);

      const [training] = (await page(true)).trainings;

      expect(training.trained).toBe(true);
      expect(training.readiness).toStrictEqual({tag: 'ready'});
      expect(training.session.yourStatus).toStrictEqual(O.some('open'));
      expect((await page(true)).hiddenEquipment).toStrictEqual(0);
    });
  });

  describe('sending people to the quiz first', () => {
    const sheetId = 'band-saw-quiz' as NonEmptyString;

    const readiness = async () => {
      await session(bandSaw, 10);
      return (await page(true)).trainings[0].readiness;
    };
    const needsQuiz = async () => (await readiness()).tag === 'needs-quiz';

    const registerQuiz = () =>
      framework.commands.equipment.trainingSheet({
        equipmentId: bandSaw,
        trainingSheetId: sheetId,
      });

    it("does not when the machine's owners have waived the quiz", async () => {
      await registerQuiz();
      await framework.commands.equipment.setTrainingRequirements({
        equipmentId: bandSaw,
        quizRequired: false,
        prerequisiteEquipmentIds: [],
      });
      expect(await readiness()).toStrictEqual({tag: 'ready'});
    });

    it('sends them to the machines it builds on before the quiz', async () => {
      await registerQuiz();
      await framework.commands.equipment.setTrainingRequirements({
        equipmentId: bandSaw,
        quizRequired: true,
        prerequisiteEquipmentIds: [lathe],
      });
      expect(await readiness()).toStrictEqual({
        tag: 'needs-prerequisites',
        missing: [{id: lathe, name: 'Lathe', trained: false}],
      });

      await markTrained(lathe);
      expect((await page(true)).trainings[0].readiness).toStrictEqual({
        tag: 'needs-quiz',
      });
    });

    beforeEach(async () => {
      await linkMember();
    });

    it('does for a machine whose quiz they have not passed', async () => {
      await framework.commands.equipment.trainingSheet({
        equipmentId: bandSaw,
        trainingSheetId: sheetId,
      });
      expect(await needsQuiz()).toBe(true);
    });

    it('does not once they have passed it', async () => {
      await framework.commands.equipment.trainingSheet({
        equipmentId: bandSaw,
        trainingSheetId: sheetId,
      });
      await framework.commands.trainingQuiz.record({
        trainingSheetId: sheetId,
        completedAt: new Date(),
        memberNumberProvided: member.memberNumber,
        emailProvided: null,
        score: 5 as Int,
        maxScore: 5 as Int,
        rowHash: faker.string.alphanumeric(64) as NonEmptyString,
      });
      expect(await needsQuiz()).toBe(false);
    });

    it('does not for a machine with no quiz to take', async () => {
      expect(await needsQuiz()).toBe(false);
    });
  });

  const linkMember = () =>
    framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: member.memberNumber,
      email: member.emailAddress,
      name: undefined,
      formOfAddress: undefined,
    });

  it('lists every machine, soonest first', async () => {
    const later = await session(bandSaw, 50);
    const sooner = await session(lathe, 5);

    expect(
      (await trainings()).map(t => [t.session.id, t.equipment.name])
    ).toStrictEqual([
      [sooner, 'Lathe'],
      [later, 'Band Saw'],
    ]);
    expect((await trainings())[0].equipment.areaName).toStrictEqual('Wood Shop');
  });

  it('leaves out trainings that are over or called off', async () => {
    await session(bandSaw, -5);
    const cancelled = await session(bandSaw, 10);
    await framework.depsForCommands.commitEvent(
      framework.sharedReadModel.getCurrentEventIndex()
    )({
      type: 'TrainingSessionCancelled',
      sessionId: cancelled,
      reason: '',
      actor: asTrainer,
      recordedAt: new Date(),
    })();

    expect(await trainings()).toStrictEqual([]);
  });

  it('leaves out machines no longer in use', async () => {
    await session(lathe, 10);
    await framework.commands.equipment.markObsolete({id: lathe});

    expect(await trainings()).toStrictEqual([]);
  });

  it('says where the reader stands with each', async () => {
    await session(bandSaw, 10, [member.memberNumber]);
    await session(lathe, 20);

    expect((await trainings()).map(t => t.session.yourStatus)).toStrictEqual([
      O.some('booked'),
      O.some('open'),
    ]);
  });

  describe('trainings on Meetup', () => {
    const meetup = async (
      title: string,
      startsInHours: number,
      description = ''
    ) => {
      const startsAt = DateTime.now().plus({hours: startsInHours});
      await framework.extDB
        .insert(meetupTrainingTable)
        .values({
          eventId: faker.string.numeric(9),
          title,
          startsAt: startsAt.toJSDate(),
          endsAt: startsAt.plus({hours: 2}).toJSDate(),
          url: 'https://www.meetup.com/makespace/events/1/',
          description,
          going: 2,
          maxTickets: 4,
          rsvpsClosed: false,
          fetchedAt: new Date(),
        })
        .run();
    };

    const shown = async (showTrained = false) =>
      (await page(showTrained)).meetupTrainings.map(t => [
        t.meetup.title,
        O.isSome(t.equipment) ? t.equipment.value.name : null,
      ]);

    it('are listed with the machine they are for, when that can be told', async () => {
      await meetup('Band Saw Training', 10);
      await meetup('First Aid Training', 20);

      expect(await shown()).toStrictEqual([
        ['Band Saw Training', 'Band Saw'],
        ['First Aid Training', null],
      ]);
    });

    it("are matched by a link to the machine's guide", async () => {
      await framework.commands.equipment.setGuideUrl({
        equipmentId: lathe,
        guideUrl: 'https://equipment.makespace.org/wood-shop/lathe' as never,
      });
      await meetup(
        'Woodturning training',
        10,
        'Do the quiz first: https://equipment.makespace.org/wood-shop/lathe'
      );

      expect(await shown()).toStrictEqual([['Woodturning training', 'Lathe']]);
    });

    it('leave out machines the reader is trained on, and count them', async () => {
      await linkMember();
      await markTrained(bandSaw);
      await meetup('Band Saw Training', 10);
      await session(bandSaw, 20);

      expect(await shown()).toStrictEqual([]);
      expect((await page()).hiddenEquipment).toStrictEqual(1);
      expect(await shown(true)).toStrictEqual([
        ['Band Saw Training', 'Band Saw'],
      ]);
    });

    it('leave out trainings that have finished', async () => {
      await meetup('Band Saw Training', -5);
      expect(await shown()).toStrictEqual([]);
    });
  });

  describe('for somebody not logged in', () => {
    it('lists everything, with nothing to sign up to in the app', async () => {
      await session(bandSaw, 10);

      const view = await page(false, O.none);

      expect(view.loggedIn).toBe(false);
      expect(view.hiddenEquipment).toStrictEqual(0);
      expect(view.trainings.map(t => t.session.yourStatus)).toStrictEqual([
        O.none,
      ]);
    });
  });
});
