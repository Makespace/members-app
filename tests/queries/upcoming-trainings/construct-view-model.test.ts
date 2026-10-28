import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';
import {DateTime} from 'luxon';
import {Actor} from '../../../src/types/actor';
import {constructViewModel} from '../../../src/queries/upcoming-trainings/construct-view-model';
import {arbitraryUser} from '../../types/user.helper';
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

  const trainings = () =>
    constructViewModel(framework.depsForCommands, member, new Date())
      .trainings;

  it('lists every machine, soonest first', async () => {
    const later = await session(bandSaw, 50);
    const sooner = await session(lathe, 5);

    expect(
      trainings().map(t => [t.session.id, t.equipment.name])
    ).toStrictEqual([
      [sooner, 'Lathe'],
      [later, 'Band Saw'],
    ]);
    expect(trainings()[0].equipment.areaName).toStrictEqual('Wood Shop');
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

    expect(trainings()).toStrictEqual([]);
  });

  it('leaves out machines no longer in use', async () => {
    await session(lathe, 10);
    await framework.commands.equipment.markObsolete({id: lathe});

    expect(trainings()).toStrictEqual([]);
  });

  it('says where the reader stands with each', async () => {
    await session(bandSaw, 10, [member.memberNumber]);
    await session(lathe, 20);

    expect(trainings().map(t => t.session.yourStatus)).toStrictEqual([
      O.some('booked'),
      O.some('open'),
    ]);
  });
});
