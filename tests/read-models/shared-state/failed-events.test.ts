import {faker} from '@faker-js/faker';
import {UUID} from 'io-ts-types';
import {failedEventsTable} from '../../../src/read-models/shared-state/state';
import {EmailAddress} from '../../../src/types';
import {arbitraryActor} from '../../helpers';
import {initTestFramework, TestFramework} from '../test-framework';

const arbitraryLinkNumberEvent = () => ({
  type: 'MemberNumberLinkedToEmail' as const,
  actor: arbitraryActor(),
  recordedAt: new Date(),
  memberNumber: faker.number.int(),
  email: faker.internet.email() as EmailAddress,
  name: undefined,
  formOfAddress: undefined,
});

const arbitraryFailingOwnerAddedEvent = () => ({
  type: 'OwnerAdded' as const,
  actor: arbitraryActor(),
  recordedAt: new Date(),
  memberNumber: faker.number.int(),
  areaId: faker.string.uuid() as UUID,
});

describe('failed-events', () => {
  let framework: TestFramework;

  beforeEach(async () => {
    framework = await initTestFramework();
  });

  afterEach(() => {
    framework.close();
  });

  it('records tracked events that fail to apply', () => {
    const failedEvent = framework.insertIntoSharedReadModel(
      arbitraryFailingOwnerAddedEvent()
    );

    const rows = framework.sharedReadModel.db
      .select()
      .from(failedEventsTable)
      .all();

    expect(framework.sharedReadModel.getCurrentEventIndex()).toStrictEqual(
      failedEvent.event_index
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].error).toContain(
      'Unable to add owner, unknown member number'
    );
    expect(rows[0].payload).toStrictEqual(
      expect.objectContaining({
        event_id: failedEvent.event_id,
        event_index: failedEvent.event_index,
        type: 'OwnerAdded',
      })
    );
  });

  it('continues applying later tracked events after a failure', () => {
    framework.insertIntoSharedReadModel(arbitraryFailingOwnerAddedEvent());
    const successfulEvent = framework.insertIntoSharedReadModel(
      arbitraryLinkNumberEvent()
    );

    expect(framework.sharedReadModel.getCurrentEventIndex()).toStrictEqual(
      successfulEvent.event_index
    );
    expect(framework.sharedReadModel.members.getAll()).toHaveLength(1);
    expect(
      framework.sharedReadModel.db.select().from(failedEventsTable).all()
    ).toHaveLength(1);
  });
});
