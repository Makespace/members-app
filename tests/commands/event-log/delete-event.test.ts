import {faker} from '@faker-js/faker';
import * as O from 'fp-ts/Option';
import {Int} from 'io-ts';
import {NonEmptyString, UUID} from 'io-ts-types';
import {StatusCodes} from 'http-status-codes';
import {v4} from 'uuid';
import {deleteEvent} from '../../../src/commands/event-log/delete-event';
import {unDeleteEvent} from '../../../src/commands/event-log/undelete-event';
import {constructEvent, DomainEvent} from '../../../src/types';
import {
  arbitraryActor,
  getLeftOrFail,
  getTaskEitherRightOrFail,
  userActor,
} from '../../helpers';
import { initTestFramework, TestFramework } from '../../read-models/test-framework';

describe('delete-event', () => {
  let framework: TestFramework;

  beforeEach(async () => {
    framework = await initTestFramework();
  });

  afterEach(() => {
    framework.close();
  });

  it('delete-event fails when dependencies are missing', async () => {
    const result = getLeftOrFail(
      await deleteEvent.process({
        command: {
          eventIndex: 1 as Int,
          deleteReason: faker.lorem.sentence(),
          actor: userActor(),
        },
        rm: framework.sharedReadModel,
      })()
    );

    expect(result).toMatchObject({
      message: 'Missing dependencies needed to update event deleted state',
      status: StatusCodes.INTERNAL_SERVER_ERROR,
    });
  });

  it('undelete fails when dependencies are missing', async () => {
    const result = getLeftOrFail(
      await unDeleteEvent.process({
        command: {
          eventIndex: 1 as Int,
          actor: arbitraryActor(),
        },
        rm: framework.sharedReadModel,
      })()
    );

    expect(result).toMatchObject({
      message: 'Missing dependencies needed to update event deleted state',
      status: StatusCodes.INTERNAL_SERVER_ERROR,
    });
  });

  it('delete event fails when the actor is not a user', async () => {
    const deps = {
      ...framework.depsForCommands,
      deleteEvent: jest.fn((_eventIndex, _deleteReason, _markDeletedByMemberNumber) => {throw Error('Placeholder')}),
    };
    const result = getLeftOrFail(
      await deleteEvent.process({
        command: {
          eventIndex: 1 as Int,
          deleteReason: faker.lorem.sentence(),
          actor: arbitraryActor(),
        },
        rm: framework.sharedReadModel,
        deps
      })()
    );

    expect(result).toMatchObject({
      message: 'Only users can delete events',
      status: StatusCodes.INTERNAL_SERVER_ERROR,
    });
    expect(deps.deleteEvent).not.toHaveBeenCalled();
  });

  it('delete event fails for a non-existent event', async() => {
    getLeftOrFail(await deleteEvent.process({
      command: {
        eventIndex: 1 as Int,
        deleteReason: faker.lorem.sentence(),
        actor: userActor(),
      },
      rm: framework.sharedReadModel,
      deps: framework.depsForCommands,
    })());
  });

  describe('marks the event as deleted', () => {
    const deletedBy = userActor();
    const deleteReason = faker.lorem.sentence();
    const arbitaryEvent = constructEvent('AreaCreated')({
      id: v4() as UUID,
      name: faker.commerce.productName() as NonEmptyString,
      actor: arbitraryActor(),
    });
    const eventIndex = 1 as Int;
    let deleteEventResult: O.Option<DomainEvent>;

    beforeEach(async () => {
      // Note that we must commit the event because it needs to exist in the eventDB otherwise it would violate the foreign key constraint.
      await getTaskEitherRightOrFail(framework.depsForCommands.commitEvent(eventIndex - 1 as Int)(arbitaryEvent));
      deleteEventResult = await getTaskEitherRightOrFail(
        deleteEvent.process({
          command: {
            eventIndex,
            deleteReason,
            actor: deletedBy,
          },
          rm: framework.sharedReadModel,
          deps: framework.depsForCommands,
        })
      );
    });

    it('doesn\'t produce an event', () => {
      expect(deleteEventResult).toStrictEqual(O.none);
    });

    it('adds the event to the deleted_events table', async () => {
      const deletedEvents = await framework.eventStoreDb.execute(
        'SELECT event_index, delete_reason, mark_deleted_by_member_number, deleted_at_unix_ms FROM deleted_events'
      );
      expect(deletedEvents.rows).toHaveLength(1);
      expect(deletedEvents.rows[0]).toMatchObject({
        event_index: eventIndex,
        delete_reason: deleteReason,
        mark_deleted_by_member_number: deletedBy.user.memberNumber,
      });
      // Check within 10 seconds.
      expect(deletedEvents.rows[0].deleted_at_unix_ms).toBeGreaterThanOrEqual(Date.now() - 1000 * 10);
    });

    describe('undeletes an event', () => {
      let undeleteResult: O.Option<DomainEvent>;
      beforeEach(async () => {
        undeleteResult = await getTaskEitherRightOrFail(
          unDeleteEvent.process({
            command: {
              eventIndex,
              actor: arbitraryActor(),
            },
            rm: framework.sharedReadModel,
            deps: framework.depsForCommands,
          })
        );
      });

      it ('doesn\'t produce an event', () => {
        expect(undeleteResult).toStrictEqual(O.none);
      });

      it('removes the event from the deleted event log', async () => {
        const deletedEvents = await framework.eventStoreDb.execute(
          'SELECT event_index FROM deleted_events'
        );
        expect(deletedEvents.rows).toStrictEqual([]);
      });
    });
  })
});
