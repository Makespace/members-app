import * as E from 'fp-ts/Either';
import {pipe} from 'fp-ts/lib/function';
import * as T from 'fp-ts/Task';
import {faker} from '@faker-js/faker';
import {UUID} from 'io-ts-types';
import {constructViewModel} from '../../../src/queries/failed-event-log/construct-view-model';
import {getRightOrFail} from '../../helpers';
import {
  initTestFramework,
  TestFramework,
} from '../../read-models/test-framework';
import {arbitraryActor} from '../../helpers';
import {arbitraryUser} from '../../types/user.helper';

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

  it('fails if the logged in user is not a super user', async () => {
    const result = await pipe(
      {},
      constructViewModel(framework.sharedReadModel)(unprivilegedUser)
    )();

    expect(result).toStrictEqual(E.left(expect.anything()));
  });

  it("fails if the logged in user isn't known to the shared state", async () => {
    const result = await pipe(
      {},
      constructViewModel(framework.sharedReadModel)(unregisteredUser)
    )();

    expect(result).toStrictEqual(E.left(expect.anything()));
  });
});
