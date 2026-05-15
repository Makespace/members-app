import {faker} from '@faker-js/faker';
import {Int} from 'io-ts';
import {NonEmptyString, UUID} from 'io-ts-types';
import {v4} from 'uuid';
import {deleteEventForm} from '../../../src/commands/event-log/delete-event-form';
import {undeleteEventForm} from '../../../src/commands/event-log/undelete-event-form';
import {constructEvent} from '../../../src/types';
import {getRightOrFail, getTaskEitherRightOrFail} from '../../helpers';
import {initTestFramework, TestFramework} from '../../read-models/test-framework';
import {arbitraryUser} from '../../types/user.helper';

describe('event log forms', () => {
  let framework: TestFramework;

  beforeEach(async () => {
    framework = await initTestFramework();
  });

  afterEach(() => {
    framework.close();
  });

  it('builds the delete event form for an active event', async () => {
    const event = constructEvent('AreaCreated')({
      id: v4() as UUID,
      name: faker.commerce.productName() as NonEmptyString,
      actor: {tag: 'system'},
    });

    await getTaskEitherRightOrFail(framework.depsForCommands.commitEvent(0 as Int)(event));

    const viewModel = getRightOrFail(
      await deleteEventForm.constructForm({
        eventIndex: '1',
        next: '/event-log?offset=10&limit=10',
      })({
        user: arbitraryUser(),
        deps: framework.depsForCommands,
        readModel: framework.sharedReadModel,
      })()
    );

    expect(viewModel).toMatchObject({
      eventIndex: 1,
      eventType: 'AreaCreated',
      eventId: expect.any(String) as unknown,
      next: '/event-log?offset=10&limit=10',
    });
  });

  it('builds the undelete event form for a deleted event', async () => {
    const event = constructEvent('AreaCreated')({
      id: v4() as UUID,
      name: faker.commerce.productName() as NonEmptyString,
      actor: {tag: 'system'},
    });

    await getTaskEitherRightOrFail(framework.depsForCommands.commitEvent(0 as Int)(event));
    await getTaskEitherRightOrFail(
      framework.depsForCommands.deleteEvent(
        1 as Int,
        faker.lorem.sentence(),
        arbitraryUser().memberNumber as Int
      )
    );

    const viewModel = getRightOrFail(
      await undeleteEventForm.constructForm({
        eventIndex: '1',
        next: '/event-log/deleted',
      })({
        user: arbitraryUser(),
        deps: framework.depsForCommands,
        readModel: framework.sharedReadModel,
      })()
    );

    expect(viewModel).toMatchObject({
      eventIndex: 1,
      eventType: 'AreaCreated',
      eventId: expect.any(String) as unknown,
      next: '/event-log/deleted',
    });
  });
});
