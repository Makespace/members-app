import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';
import {StatusCodes} from 'http-status-codes';
import {DateTime} from 'luxon';
import {Actor} from '../../../src/types/actor';
import {signUp} from '../../../src/commands/training-sessions/sign-up';
import {cancelPlace} from '../../../src/commands/training-sessions/cancel-place';
import {cancelSession} from '../../../src/commands/training-sessions/cancel';
import {constructViewModel as getTrainedViewModel} from '../../../src/queries/equipment-training/construct-view-model';
import {arbitraryUser} from '../../types/user.helper';
import {
  getLeftOrFail,
  getRightOrFail,
  getSomeOrFail,
  getTaskEitherRightOrFail,
} from '../../helpers';
import {
  initTestFramework,
  TestFramework,
} from '../../read-models/test-framework';

describe('signing up for training sessions', () => {
  let framework: TestFramework;
  const areaId = faker.string.uuid() as UUID;
  const equipmentId = faker.string.uuid() as UUID;
  const trainer = arbitraryUser();
  const member = arbitraryUser();
  const otherMember = arbitraryUser();
  const as = (user: typeof member): Actor => ({tag: 'user', user});

  beforeEach(async () => {
    framework = await initTestFramework();
    await framework.commands.area.create({
      id: areaId,
      name: 'Wood Shop' as NonEmptyString,
    });
    await framework.commands.equipment.add({
      id: equipmentId,
      name: 'Band Saw' as NonEmptyString,
      areaId,
    });
    for (const user of [trainer, member, otherMember]) {
      await framework.commands.memberNumbers.linkNumberToEmail({
        memberNumber: user.memberNumber,
        email: user.emailAddress,
        name: undefined,
        formOfAddress: undefined,
      });
    }
    await framework.commands.area.addOwner({
      areaId,
      memberNumber: trainer.memberNumber,
    });
    await framework.commands.trainers.add({
      equipmentId,
      memberNumber: trainer.memberNumber,
    });
  });

  afterEach(() => {
    framework.close();
  });

  // Straight into the event log, so a session can start sooner than the
  // arrange command would allow - which is what these rules are about.
  const session = async (
    options: {
      startsInHours?: number;
      spaces?: number;
      closeHoursBefore?: number;
      attendees?: number[];
    } = {}
  ) => {
    const sessionId = faker.string.uuid() as UUID;
    const startsAt = DateTime.now().plus({hours: options.startsInHours ?? 48});
    await framework.depsForCommands.commitEvent(
      framework.sharedReadModel.getCurrentEventIndex()
    )({
      type: 'TrainingSessionScheduled',
      sessionId,
      equipmentId,
      trainerMemberNumber: trainer.memberNumber,
      startsAt: startsAt.toJSDate(),
      endsAt: startsAt.plus({hours: 2}).toJSDate(),
      spaces: options.spaces ?? 2,
      description: '',
      attendees: options.attendees ?? [],
      signUpsCloseHoursBefore: options.closeHoursBefore ?? 0,
      actor: as(trainer),
      recordedAt: new Date(),
    })();
    return sessionId;
  };

  const processSignUp = (sessionId: UUID, user = member) =>
    signUp.process({
      command: {sessionId, actor: as(user)},
      rm: framework.sharedReadModel,
    });

  const attendeesOf = (sessionId: UUID) =>
    getSomeOrFail(framework.sharedReadModel.trainingSessions.get(sessionId))
      .attendees;

  describe('taking a place', () => {
    it('books the member on', async () => {
      const sessionId = await session();
      const event = getSomeOrFail(
        await getTaskEitherRightOrFail(processSignUp(sessionId))
      );
      expect(event).toMatchObject({
        type: 'TrainingSessionSignedUp',
        sessionId,
        memberNumber: member.memberNumber,
      });

      await framework.commands.trainingSessions.signUp({
        sessionId,
        actor: as(member),
      });
      expect(attendeesOf(sessionId)).toStrictEqual([member.memberNumber]);
    });

    it('records nothing for a member already booked', async () => {
      const sessionId = await session({attendees: [member.memberNumber]});
      expect(
        await getTaskEitherRightOrFail(processSignUp(sessionId))
      ).toStrictEqual(O.none);
    });

    it('refuses a full session', async () => {
      const sessionId = await session({
        spaces: 1,
        attendees: [otherMember.memberNumber],
      });
      const failure = getLeftOrFail(await processSignUp(sessionId)());
      expect(failure.status).toStrictEqual(StatusCodes.BAD_REQUEST);
    });

    it('refuses once sign-ups have closed', async () => {
      const sessionId = await session({startsInHours: 3, closeHoursBefore: 4});
      const failure = getLeftOrFail(await processSignUp(sessionId)());
      expect(failure.status).toStrictEqual(StatusCodes.BAD_REQUEST);
    });

    it('stays open until the closing time', async () => {
      const sessionId = await session({startsInHours: 5, closeHoursBefore: 4});
      getSomeOrFail(await getTaskEitherRightOrFail(processSignUp(sessionId)));
    });

    it('does not let the trainer sign up to their own session', async () => {
      const sessionId = await session();
      const failure = getLeftOrFail(
        await processSignUp(sessionId, trainer)()
      );
      expect(failure.status).toStrictEqual(StatusCodes.BAD_REQUEST);
    });

    it('refuses a cancelled session', async () => {
      const sessionId = await session();
      await framework.commands.trainingSessions.cancel({
        sessionId,
        reason: '',
        actor: as(trainer),
      });
      const failure = getLeftOrFail(await processSignUp(sessionId)());
      expect(failure.status).toStrictEqual(StatusCodes.BAD_REQUEST);
    });
  });

  describe('giving up a place', () => {
    const processCancelPlace = (sessionId: UUID) =>
      cancelPlace.process({
        command: {sessionId, actor: as(member)},
        rm: framework.sharedReadModel,
      });

    it('frees the place for somebody else', async () => {
      const sessionId = await session({
        spaces: 1,
        attendees: [member.memberNumber],
      });
      await framework.commands.trainingSessions.cancelPlace({
        sessionId,
        actor: as(member),
      });
      expect(attendeesOf(sessionId)).toStrictEqual([]);

      getSomeOrFail(
        await getTaskEitherRightOrFail(processSignUp(sessionId, otherMember))
      );
    });

    it('records nothing for a member who was not booked', async () => {
      const sessionId = await session();
      expect(
        await getTaskEitherRightOrFail(processCancelPlace(sessionId))
      ).toStrictEqual(O.none);
    });

    it('is still possible after sign-ups close, until it starts', async () => {
      const sessionId = await session({
        startsInHours: 1,
        closeHoursBefore: 4,
        attendees: [member.memberNumber],
      });
      getSomeOrFail(
        await getTaskEitherRightOrFail(processCancelPlace(sessionId))
      );
    });

    it('is refused once it has started', async () => {
      const sessionId = await session({
        startsInHours: -1,
        attendees: [member.memberNumber],
      });
      const failure = getLeftOrFail(await processCancelPlace(sessionId)());
      expect(failure.status).toStrictEqual(StatusCodes.BAD_REQUEST);
    });
  });

  describe('calling a session off', () => {
    const authorized = async (user: typeof member) =>
      cancelSession.isAuthorized({
        actor: as(user),
        rm: framework.sharedReadModel,
        input: {sessionId: await session(), reason: ''},
      });

    it('is for trainers on the machine', async () => {
      expect(await authorized(trainer)).toBe(true);
      expect(await authorized(member)).toBe(false);
    });

    it('keeps who was booked, so they can be told, with the reason', async () => {
      const sessionId = await session({attendees: [member.memberNumber]});
      await framework.commands.trainingSessions.cancel({
        sessionId,
        reason: 'Machine is broken',
        actor: as(trainer),
      });
      const cancelled = getSomeOrFail(
        framework.sharedReadModel.trainingSessions.get(sessionId)
      );
      expect(cancelled.attendees).toStrictEqual([member.memberNumber]);
      expect(getSomeOrFail(cancelled.cancelled).reason).toStrictEqual(
        'Machine is broken'
      );
    });

    it('records nothing a second time', async () => {
      const sessionId = await session();
      await framework.commands.trainingSessions.cancel({
        sessionId,
        reason: '',
        actor: as(trainer),
      });
      expect(
        await getTaskEitherRightOrFail(
          cancelSession.process({
            command: {sessionId, reason: '', actor: as(trainer)},
            rm: framework.sharedReadModel,
          })
        )
      ).toStrictEqual(O.none);
    });

    it('is refused for a session that has already happened', async () => {
      const sessionId = await session({startsInHours: -5});
      const failure = getLeftOrFail(
        await cancelSession.process({
          command: {sessionId, reason: '', actor: as(trainer)},
          rm: framework.sharedReadModel,
        })()
      );
      expect(failure.status).toStrictEqual(StatusCodes.BAD_REQUEST);
    });
  });

  describe('what the get-trained page offers', () => {
    const upcoming = async (user = member) =>
      getRightOrFail(
        await getTrainedViewModel(framework.depsForCommands, user)(
          equipmentId
        )()
      ).upcomingTrainings;

    it("says where the reader stands with each session", async () => {
      const open = await session({startsInHours: 10});
      const booked = await session({
        startsInHours: 20,
        attendees: [member.memberNumber],
      });
      const full = await session({
        startsInHours: 30,
        spaces: 1,
        attendees: [otherMember.memberNumber],
      });
      const closed = await session({startsInHours: 40, closeHoursBefore: 48});

      const status = Object.fromEntries(
        (await upcoming()).map(s => [s.id, s.yourStatus])
      );

      expect(status).toStrictEqual({
        [open]: O.some('open'),
        [booked]: O.some('booked'),
        [full]: O.some('full'),
        [closed]: O.some('closed'),
      });
    });

    it('leaves out a cancelled session', async () => {
      const sessionId = await session();
      await framework.commands.trainingSessions.cancel({
        sessionId,
        reason: '',
        actor: as(trainer),
      });
      expect(await upcoming()).toStrictEqual([]);
    });
  });
});
