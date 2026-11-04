import * as O from 'fp-ts/Option';
import * as E from 'fp-ts/Either';
import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';
import {StatusCodes} from 'http-status-codes';
import {DateTime} from 'luxon';
import {constructViewModel} from '../../../src/queries/admin/construct-view-model';
import {admin} from '../../../src/queries/admin';
import {arbitraryUser} from '../../types/user.helper';
import {getLeftOrFail, getRightOrFail} from '../../helpers';
import {
  initTestFramework,
  TestFramework,
} from '../../read-models/test-framework';

// What the navbar's Owner page lists for somebody who looks after areas.
describe('the owner page', () => {
  let framework: TestFramework;
  const owner = arbitraryUser();
  const member = arbitraryUser();
  const woodShop = faker.string.uuid() as UUID;
  const metalShop = faker.string.uuid() as UUID;
  const bandSaw = faker.string.uuid() as UUID;
  const tableSaw = faker.string.uuid() as UUID;
  const oldPlaner = faker.string.uuid() as UUID;
  const lathe = faker.string.uuid() as UUID;

  beforeEach(async () => {
    framework = await initTestFramework();
    for (const user of [owner, member]) {
      await framework.commands.memberNumbers.linkNumberToEmail({
        memberNumber: user.memberNumber,
        email: user.emailAddress,
        name: undefined,
        formOfAddress: undefined,
      });
    }
    for (const [id, name] of [
      [woodShop, 'Wood Shop'],
      [metalShop, 'Metal Shop'],
    ] as const) {
      await framework.commands.area.create({id, name: name as NonEmptyString});
    }
    for (const [id, name, areaId] of [
      [bandSaw, 'Band Saw', woodShop],
      [tableSaw, 'Table Saw', woodShop],
      [oldPlaner, 'Planer', woodShop],
      [lathe, 'Lathe', metalShop],
    ] as const) {
      await framework.commands.equipment.add({
        id,
        name: name as NonEmptyString,
        areaId,
      });
    }
    await framework.commands.area.addOwner({
      areaId: woodShop,
      memberNumber: owner.memberNumber,
    });
    // Trains on the band saw and the planer here, and the lathe in an area
    // they do not own; not on the table saw.
    for (const equipmentId of [bandSaw, oldPlaner, lathe]) {
      await framework.commands.trainers.add({
        equipmentId,
        memberNumber: owner.memberNumber,
      });
    }
    await framework.commands.equipment.markObsolete({id: oldPlaner});
  });

  afterEach(() => {
    framework.close();
  });

  const viewModelFor = async (user = owner) =>
    getRightOrFail(
      await constructViewModel(framework.depsForCommands, user)()
    );

  it('lists the areas they own, with the machines in each they train on', async () => {
    const viewModel = await viewModelFor();

    expect(viewModel.isSuperUser).toBe(false);
    expect(viewModel.ownedAreas).toMatchObject([
      {
        id: woodShop,
        name: 'Wood Shop',
        purchasingAreaId: O.none,
        openTickets: 0,
        trainerOn: [
          {
            id: bandSaw,
            name: 'Band Saw',
            openTickets: 0,
            upcomingTrainings: 0,
            doneOnlineTraining: 0,
            askedToBeTrained: 0,
            earliestSince: O.none,
          },
        ],
      },
    ]);
    expect(viewModel.ownedAreas[0].trainerOn).toHaveLength(1);
  });

  it('says how many are waiting on each machine, and for how long', async () => {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    await framework.depsForCommands.commitEvent(
      framework.sharedReadModel.getCurrentEventIndex()
    )({
      type: 'TrainingInterestExpressed',
      equipmentId: bandSaw,
      memberNumber: member.memberNumber,
      actor: {tag: 'system'},
      recordedAt: since,
    })();

    const [machine] = (await viewModelFor()).ownedAreas[0].trainerOn;

    // They asked, rather than doing the online training.
    expect(machine).toMatchObject({doneOnlineTraining: 0, askedToBeTrained: 1});
    expect(machine.earliestSince).toStrictEqual(O.some(since));
  });

  it('counts open tickets in the area and on the machine, and upcoming trainings', async () => {
    await framework.commands.troubleTickets.create({
      id: faker.string.uuid() as UUID,
      submittedEquipment: 'Band Saw',
      submittedMemberNumber: null,
      submittedEmail: null,
      submittedName: null,
      otherEquipmentDetail: '',
      status: 'Down',
      attempting: '',
      issue: 'Blade snapped',
      steps: '',
    });
    const startsAt = DateTime.now().plus({days: 3});
    await framework.depsForCommands.commitEvent(
      framework.sharedReadModel.getCurrentEventIndex()
    )({
      type: 'TrainingSessionScheduled',
      sessionId: faker.string.uuid() as UUID,
      equipmentId: bandSaw,
      trainerMemberNumber: owner.memberNumber,
      startsAt: startsAt.toJSDate(),
      endsAt: startsAt.plus({hours: 2}).toJSDate(),
      spaces: 3,
      description: '',
      attendees: [],
      signUpsCloseHoursBefore: 0,
      actor: {tag: 'user', user: owner},
      recordedAt: new Date(),
    })();

    const [area] = (await viewModelFor()).ownedAreas;

    expect(area.openTickets).toStrictEqual(1);
    expect(area.trainerOn[0]).toMatchObject({
      openTickets: 1,
      upcomingTrainings: 1,
    });
  });

  it('lets an owner in', async () => {
    const page = await admin(framework.depsForCommands)(owner, {}, {})();
    expect(E.isRight(page)).toBe(true);
  });

  it('turns away somebody who is neither an owner nor a super-user', async () => {
    const failure = getLeftOrFail(
      await admin(framework.depsForCommands)(member, {}, {})()
    );
    expect(failure.status).toStrictEqual(StatusCodes.FORBIDDEN);
  });
});
