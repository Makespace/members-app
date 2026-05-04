import {faker} from '@faker-js/faker';
import * as O from 'fp-ts/Option';
import {Int} from 'io-ts';
import {UUID} from 'io-ts-types';
import {failedEventsTable} from '../../../src/read-models/shared-state/state';
import {EmailAddress} from '../../../src/types';
import {
  TestFramework,
  initTestFramework,
} from '../test-framework';
import {
  arbitraryActor,
  getSomeOrFail,
  getTaskEitherRightOrFail,
} from '../../helpers';

const arbitraryLinkNumberEvent = (
  memberNumber: number,
  email: EmailAddress
) => ({
  type: 'MemberNumberLinkedToEmail' as const,
  actor: arbitraryActor(),
  recordedAt: new Date(),
  memberNumber,
  email,
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

describe('shared-read-model reset', () => {
  let framework: TestFramework;

  beforeEach(async () => {
    framework = await initTestFramework();
  });

  afterEach(() => {
    framework.close();
  });

  it('rebuilds tracked state from the event store and drops local-only changes', async () => {
    const persistedMemberNumber = 101;
    const localOnlyMemberNumber = 102;
    const persistedEmail = 'persisted@example.com' as EmailAddress;
    const localOnlyEmail = 'local-only@example.com' as EmailAddress;

    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: persistedMemberNumber,
      email: persistedEmail,
      name: undefined,
      formOfAddress: undefined,
    });
    framework.insertIntoSharedReadModel(
      arbitraryLinkNumberEvent(localOnlyMemberNumber, localOnlyEmail)
    );

    expect(framework.sharedReadModel.members.getAll()).toHaveLength(2);
    expect(framework.sharedReadModel.getCurrentEventIndex()).toStrictEqual(2);

    await framework.sharedReadModel.reset();

    expect(framework.sharedReadModel.members.getAll()).toHaveLength(1);
    getSomeOrFail(framework.sharedReadModel.members.getByMemberNumber(persistedMemberNumber));
    expect(
      framework.sharedReadModel.members.getByMemberNumber(localOnlyMemberNumber)
    ).toStrictEqual(O.none);
    expect(framework.sharedReadModel.getCurrentEventIndex()).toStrictEqual(1);
  });

  it('recomputes failed events from the event store deleted state', async () => {
    await getTaskEitherRightOrFail(
      framework.depsForCommands.commitEvent(
        framework.sharedReadModel.getCurrentEventIndex()
      )(arbitraryFailingOwnerAddedEvent())
    );
    const [failedEvent] = await framework.getAllEvents();

    expect(
      framework.sharedReadModel.db.select().from(failedEventsTable).all()
    ).toHaveLength(1);

    await getTaskEitherRightOrFail(
      framework.depsForCommands.deleteEvent(
        failedEvent.event_index,
        'deleted for reset test',
        1 as Int
      )
    );

    await framework.sharedReadModel.reset();

    expect(
      framework.sharedReadModel.db.select().from(failedEventsTable).all()
    ).toHaveLength(0);
    expect(framework.sharedReadModel.getCurrentEventIndex()).toStrictEqual(
      failedEvent.event_index
    );
  });
});
