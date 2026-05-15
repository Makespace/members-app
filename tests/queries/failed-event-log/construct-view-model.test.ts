import {pipe} from 'fp-ts/lib/function';
import * as T from 'fp-ts/Task';
import {faker} from '@faker-js/faker';
import {UUID} from 'io-ts-types';
import {constructViewModel} from '../../../src/queries/failed-event-log/construct-view-model';
import {getLeftOrFail, getRightOrFail, getTaskEitherRightOrFail} from '../../helpers';
import {
  initTestFramework,
  TestFramework,
} from '../../read-models/test-framework';
import {arbitraryActor} from '../../helpers';
import {arbitraryUser} from '../../types/user.helper';
import { liftActorOrUser } from '../../../src/read-models/lift-actor-or-user';
import { Int } from 'io-ts';

const arbitraryFailingOwnerAddedEvent = () => ({
  type: 'OwnerAdded' as const,
  actor: arbitraryActor(),
  recordedAt: new Date(),
  memberNumber: faker.number.int(),
  areaId: faker.string.uuid() as UUID,
});

describe('construct-view-model', () => {
  let framework: TestFramework;

  beforeEach(async () => {
    framework = await initTestFramework();
  });

  afterEach(() => {
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

  it('shows all failed events to super users', async () => {
    const firstFailedEvent = framework.insertIntoSharedReadModel(
      arbitraryFailingOwnerAddedEvent()
    );
    const secondFailedEvent = framework.insertIntoSharedReadModel(
      arbitraryFailingOwnerAddedEvent()
    );

    const result = await pipe(
      {offset: '0', limit: '1'},
      constructViewModel(framework.sharedReadModel)(superUser),
      T.map(getRightOrFail)
    )();

    expect(result.count).toStrictEqual(2);
    expect(result.failures).toHaveLength(2);
    expect(result.failures[0].error).toContain(
      'Unable to add owner, unknown member number'
    );
    expect(result.failures[0].eventType).toStrictEqual('OwnerAdded');
    expect(result.failures[0].payload).toStrictEqual(
      expect.objectContaining({
        event_id: secondFailedEvent.event_id,
        event_index: secondFailedEvent.event_index,
      })
    );
    expect(result.failures[1].payload).toStrictEqual(
      expect.objectContaining({
        event_id: firstFailedEvent.event_id,
        event_index: firstFailedEvent.event_index,
      })
    );
  });

  it('hides deleted failed events', async () => {
    await getTaskEitherRightOrFail(framework.depsForCommands.commitEvent(3 as Int)(arbitraryFailingOwnerAddedEvent()));
    await framework.commands.eventLog.delete({
      eventIndex: 4 as Int, // Last seen index (3) + 1.
      deleteReason: faker.lorem.sentence(),
      actor: liftActorOrUser(superUser),
    });

    const result = await pipe(
      {},
      constructViewModel(framework.sharedReadModel)(superUser),
      T.map(getRightOrFail)
    )();

    expect(result.count).toStrictEqual(0);
    expect(result.failures).toHaveLength(0);
  });

  it('fails if the logged in user is not a super user', async () => {
    getLeftOrFail(
      await constructViewModel(framework.sharedReadModel)(unprivilegedUser)({})()
    );
  });

  it("fails if the logged in user isn't known to the shared state", async () => {
    getLeftOrFail(
      await constructViewModel(framework.sharedReadModel)(unregisteredUser)({})()
    );
  });
});
