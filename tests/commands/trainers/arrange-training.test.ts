import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';
import {StatusCodes} from 'http-status-codes';
import {DateTime} from 'luxon';
import {
  arrangeTraining,
  ArrangeTraining,
} from '../../../src/commands/trainers/arrange-training';
import {Actor} from '../../../src/types/actor';
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
import {constructViewModel} from '../../../src/queries/equipment-training/construct-view-model';
import {constructViewModel as trainingsViewModel} from '../../../src/queries/equipment-trainings/construct-view-model';
import {arrangeTrainingForm} from '../../../src/commands/trainers/arrange-training-form';

describe('arranging a training session', () => {
  const sessionId = faker.string.uuid() as UUID;
  const equipmentId = faker.string.uuid() as UUID;

  const form = (overrides: Record<string, unknown> = {}) => ({
    sessionId,
    equipmentId,
    date: '2026-11-07',
    startTime: '18:00',
    endTime: '20:00',
    spaces: '4',
    ...overrides,
  });

  describe('reading the form', () => {
    it('reads the times as UK time in winter', () => {
      const decoded = getRightOrFail(arrangeTraining.decode(form()));
      expect(decoded.startsAt.toISOString()).toStrictEqual(
        '2026-11-07T18:00:00.000Z'
      );
      expect(decoded.endsAt.toISOString()).toStrictEqual(
        '2026-11-07T20:00:00.000Z'
      );
      expect(decoded.spaces).toStrictEqual(4);
      expect(decoded.attendees).toStrictEqual([]);
      expect(decoded.description).toStrictEqual('');
      expect(decoded.signUpsCloseHoursBefore).toStrictEqual(1);
    });

    it('takes when sign-ups close from the choices offered', () => {
      expect(
        getRightOrFail(
          arrangeTraining.decode(form({signUpsCloseHoursBefore: '24'}))
        ).signUpsCloseHoursBefore
      ).toStrictEqual(24);
      expect(
        E.isLeft(arrangeTraining.decode(form({signUpsCloseHoursBefore: '3'})))
      ).toBe(true);
    });

    it('keeps the description, trimmed', () => {
      expect(
        getRightOrFail(
          arrangeTraining.decode(form({description: '  Bring shoes.\n'}))
        ).description
      ).toStrictEqual('Bring shoes.');
    });

    it.each([
      ['one member', '12', [12]],
      ['several members', ['12', '34'], [12, 34]],
      ['the same member twice once', ['12', '12'], [12]],
      ['inputs left empty as nobody', ['', ' 12 ', ''], [12]],
    ])('books in %s', (_, attendees, expected) => {
      expect(
        getRightOrFail(arrangeTraining.decode(form({attendees}))).attendees
      ).toStrictEqual(expected);
    });

    it('reads the times as UK time in summer', () => {
      const decoded = getRightOrFail(
        arrangeTraining.decode(form({date: '2026-07-01'}))
      );
      expect(decoded.startsAt.toISOString()).toStrictEqual(
        '2026-07-01T17:00:00.000Z'
      );
    });

    it.each([
      ['an end before the start', {startTime: '20:00', endTime: '18:00'}],
      ['an end equal to the start', {endTime: '18:00'}],
      ['no spaces', {spaces: '0'}],
      ['too many spaces', {spaces: '51'}],
      ['a fractional number of spaces', {spaces: '2.5'}],
      ['a missing day', {date: ''}],
      ['an impossible day', {date: '2026-02-30'}],
      ['a malformed time', {startTime: '6pm'}],
      ['a member given by name', {attendees: 'Ada'}],
      ['an overlong description', {description: 'x'.repeat(2001)}],
      [
        'more members booked in than spaces',
        {spaces: '2', attendees: ['1', '2', '3']},
      ],
    ])('rejects %s', (_, overrides) => {
      expect(E.isLeft(arrangeTraining.decode(form(overrides)))).toBe(true);
    });
  });

  describe('against the read model', () => {
    let framework: TestFramework;
    const areaId = faker.string.uuid() as UUID;
    const trainer = arbitraryUser();
    const otherMember = arbitraryUser();
    const trainerActor: Actor = {tag: 'user', user: trainer};
    const otherActor: Actor = {tag: 'user', user: otherMember};

    const inDays = (days: number, hours = 2): ArrangeTraining => {
      const startsAt = DateTime.now().plus({days});
      return {
        sessionId: faker.string.uuid() as UUID,
        equipmentId,
        startsAt: startsAt.toJSDate(),
        endsAt: startsAt.plus({hours}).toJSDate(),
        spaces: 4,
        description: 'Bring closed-toe shoes.',
        attendees: [],
        signUpsCloseHoursBefore: 0,
      };
    };

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
      for (const member of [trainer, otherMember]) {
        await framework.commands.memberNumbers.linkNumberToEmail({
          memberNumber: member.memberNumber,
          email: member.emailAddress,
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

    const isAuthorized = (actor: Actor) =>
      arrangeTraining.isAuthorized({
        actor,
        rm: framework.sharedReadModel,
        input: inDays(7),
      });

    it('lets a trainer on the machine arrange one', () => {
      expect(isAuthorized(trainerActor)).toBe(true);
    });

    it('does not let anybody else', () => {
      expect(isAuthorized(otherActor)).toBe(false);
      expect(isAuthorized({tag: 'token', token: 'admin'})).toBe(false);
    });

    const process = (command: ArrangeTraining) =>
      arrangeTraining.process({
        command: {...command, actor: trainerActor},
        rm: framework.sharedReadModel,
      });

    it('records the trainer who arranged it as the trainer', async () => {
      const command = inDays(7);
      const event = getSomeOrFail(
        await getTaskEitherRightOrFail(process(command))
      );
      expect(event).toMatchObject({
        type: 'TrainingSessionScheduled',
        sessionId: command.sessionId,
        equipmentId,
        trainerMemberNumber: trainer.memberNumber,
        startsAt: command.startsAt,
        endsAt: command.endsAt,
        spaces: 4,
      });
    });

    it('refuses a time that has already passed', async () => {
      const failure = getLeftOrFail(await process(inDays(-1))());
      expect(failure.status).toStrictEqual(StatusCodes.BAD_REQUEST);
    });

    it('refuses a machine that does not exist', async () => {
      const failure = getLeftOrFail(
        await process({
          ...inDays(7),
          equipmentId: faker.string.uuid() as UUID,
        })()
      );
      expect(failure.status).toStrictEqual(StatusCodes.NOT_FOUND);
    });

    it('books in members the trainer arranged it with', async () => {
      const event = getSomeOrFail(
        await getTaskEitherRightOrFail(
          process({...inDays(7), attendees: [otherMember.memberNumber]})
        )
      );
      expect(event).toMatchObject({attendees: [otherMember.memberNumber]});
    });

    it('refuses to book in a member number nobody has', async () => {
      const failure = getLeftOrFail(
        await process({...inDays(7), attendees: [999999999]})()
      );
      expect(failure.status).toStrictEqual(StatusCodes.BAD_REQUEST);
    });

    it('records a resubmitted form only once', async () => {
      const command = inDays(7);
      await framework.commands.trainers.arrangeTraining({
        ...command,
        actor: trainerActor,
      });
      expect(await getTaskEitherRightOrFail(process(command))).toStrictEqual(
        O.none
      );
    });

    describe('what the get-trained page shows', () => {
      const viewModel = async () =>
        getRightOrFail(
          await constructViewModel(
            framework.depsForCommands,
            otherMember
          )(equipmentId)()
        );

      it('lists sessions that have not finished, soonest first', async () => {
        const later = inDays(14);
        const sooner = inDays(3);
        for (const command of [later, sooner]) {
          await framework.commands.trainers.arrangeTraining({
            ...command,
            actor: trainerActor,
          });
        }

        const {upcomingTrainings} = await viewModel();

        expect(upcomingTrainings.map(s => s.startsAt)).toStrictEqual([
          sooner.startsAt,
          later.startsAt,
        ]);
        expect(upcomingTrainings[0].trainer.memberNumber).toStrictEqual(
          trainer.memberNumber
        );
      });

      it('counts members booked in against the spaces', async () => {
        await framework.commands.trainers.arrangeTraining({
          ...inDays(3),
          attendees: [otherMember.memberNumber],
          actor: trainerActor,
        });

        const [session] = (await viewModel()).upcomingTrainings;

        expect(session).toMatchObject({spaces: 4, booked: 1});
      });

      it('leaves out sessions that have finished', async () => {
        await framework.commands.trainers.arrangeTraining({
          ...inDays(3),
          actor: trainerActor,
        });
        // Straight into the read model, as the command will not arrange one
        // in the past.
        await framework.depsForCommands.commitEvent(
          framework.sharedReadModel.getCurrentEventIndex()
        )({
          type: 'TrainingSessionScheduled',
          sessionId: faker.string.uuid() as UUID,
          equipmentId,
          trainerMemberNumber: trainer.memberNumber,
          startsAt: DateTime.now().minus({days: 2}).toJSDate(),
          endsAt: DateTime.now().minus({days: 2, hours: -2}).toJSDate(),
          spaces: 4,
          description: '',
          attendees: [],
          signUpsCloseHoursBefore: 0,
          actor: trainerActor,
          recordedAt: new Date(),
        })();

        expect((await viewModel()).upcomingTrainings).toHaveLength(1);
      });

      it('counts how many trainers have used the app to arrange one', async () => {
        expect((await viewModel()).trainersUsingApp).toStrictEqual(0);

        await framework.commands.trainers.arrangeTraining({
          ...inDays(3),
          actor: trainerActor,
        });
        await framework.commands.trainers.arrangeTraining({
          ...inDays(10),
          actor: trainerActor,
        });

        expect((await viewModel()).trainersUsingApp).toStrictEqual(1);
      });
    });

    describe('the arrange form', () => {
      const formFor = async (query: Record<string, unknown>) =>
        arrangeTrainingForm.constructForm({equipmentId, ...query})({
          user: trainer,
          deps: framework.depsForCommands,
          readModel: framework.sharedReadModel,
        })();

      it('starts a new training with a link to the machine in the description', async () => {
        const form = getRightOrFail(await formFor({}));
        expect(form.duplicating).toBe(false);
        expect(form.prefill.description).toContain(
          `[Band Saw](http://localhost:8080/equipment/${equipmentId})`
        );
      });

      it('copies an earlier session apart from its day and who was booked in', async () => {
        const original = {
          ...inDays(3),
          startsAt: DateTime.fromISO('2030-01-05T18:30', {
            zone: 'Europe/London',
          }).toJSDate(),
          endsAt: DateTime.fromISO('2030-01-05T21:00', {
            zone: 'Europe/London',
          }).toJSDate(),
          spaces: 6,
          description: 'Bring closed-toe shoes.',
          attendees: [otherMember.memberNumber],
          signUpsCloseHoursBefore: 4,
        };
        await framework.commands.trainers.arrangeTraining({
          ...original,
          actor: trainerActor,
        });

        const form = getRightOrFail(
          await formFor({from: original.sessionId})
        );

        expect(form.duplicating).toBe(true);
        expect(form.prefill).toStrictEqual({
          startTime: '18:30',
          endTime: '21:00',
          spaces: '6',
          description: 'Bring closed-toe shoes.',
          signUpsCloseHoursBefore: 4,
        });
        // There is nowhere for a day or members to come through: both are
        // asked for afresh.
        expect(Object.keys(form.prefill)).not.toContain('date');
        expect(Object.keys(form.prefill)).not.toContain('attendees');
      });

      it('will not copy a session from another machine', async () => {
        const otherEquipmentId = faker.string.uuid() as UUID;
        await framework.commands.equipment.add({
          id: otherEquipmentId,
          name: 'Lathe' as NonEmptyString,
          areaId,
        });
        await framework.commands.trainers.add({
          equipmentId: otherEquipmentId,
          memberNumber: trainer.memberNumber,
        });
        const elsewhere = {...inDays(3), equipmentId: otherEquipmentId};
        await framework.commands.trainers.arrangeTraining({
          ...elsewhere,
          actor: trainerActor,
        });

        const failure = getLeftOrFail(
          await formFor({from: elsewhere.sessionId})
        );
        expect(failure.status).toStrictEqual(StatusCodes.NOT_FOUND);
      });
    });

    describe("the machine's trainings page", () => {
      const trainingsPage = (user = trainer) =>
        trainingsViewModel(
          framework.depsForCommands,
          user,
          new Date()
        )(equipmentId)();

      it('is only for trainers on the machine', async () => {
        const failure = getLeftOrFail(await trainingsPage(otherMember));
        expect(failure.status).toStrictEqual(StatusCodes.FORBIDDEN);
      });

      it('splits sessions into upcoming, soonest first, and previous, latest first', async () => {
        const sessions = {
          soon: inDays(2),
          later: inDays(9),
          lastWeek: inDays(-7),
          lastMonth: inDays(-30),
        };
        for (const command of Object.values(sessions)) {
          await framework.depsForCommands.commitEvent(
            framework.sharedReadModel.getCurrentEventIndex()
          )({
            type: 'TrainingSessionScheduled',
            ...command,
            trainerMemberNumber: trainer.memberNumber,
            actor: trainerActor,
            recordedAt: new Date(),
          })();
        }

        const page = getRightOrFail(await trainingsPage());

        expect(page.upcoming.map(s => s.id)).toStrictEqual([
          sessions.soon.sessionId,
          sessions.later.sessionId,
        ]);
        expect(page.previous.map(s => s.id)).toStrictEqual([
          sessions.lastWeek.sessionId,
          sessions.lastMonth.sessionId,
        ]);
      });

      it("offers to duplicate the reader's own latest session", async () => {
        expect(getRightOrFail(await trainingsPage()).lastOwnSessionId).toStrictEqual(
          O.none
        );

        const earlier = inDays(2);
        const latest = inDays(9);
        for (const command of [latest, earlier]) {
          await framework.commands.trainers.arrangeTraining({
            ...command,
            actor: trainerActor,
          });
        }

        expect(getRightOrFail(await trainingsPage()).lastOwnSessionId).toStrictEqual(
          O.some(latest.sessionId)
        );
      });
    });
  });
});
