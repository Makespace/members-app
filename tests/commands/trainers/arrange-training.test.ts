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
        attendees: [],
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
          attendees: [],
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
  });
});
