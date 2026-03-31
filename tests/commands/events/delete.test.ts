import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {faker} from '@faker-js/faker';
import {StatusCodes} from 'http-status-codes';
import {NonEmptyString, UUID} from 'io-ts-types';
import {deleteEventCommand} from '../../../src/commands/events/delete';
import {Dependencies} from '../../../src/dependencies';
import {
  arbitraryActor,
  getLeftOrFail,
  getTaskEitherRightOrFail,
} from '../../helpers';

const baseDeps = {
  commitEvent: () => () =>
    TE.right({
      status: StatusCodes.CREATED as StatusCodes.CREATED,
      message: '',
    }),
  getAllEvents: () => TE.right([]),
  getAllEventsIncludingDeleted: () => TE.right([]),
  getAllEventsByType: () => TE.right([]),
  getDeletedEventById: () => TE.right(O.none),
  deleteEvent: () =>
    TE.right({
      status: StatusCodes.CREATED as StatusCodes.CREATED,
      message: '',
    }),
  getEventById: () => TE.right(O.none),
  getResourceEvents: () => TE.right({events: [], version: 0}),
  sharedReadModel: {} as never,
  logger: {} as never,
  rateLimitSendingOfEmails: TE.right,
  sendEmail: () => TE.right('success'),
  lastQuizSync: () => TE.right(O.none),
  getSheetData: () => TE.right([]),
  getSheetDataByMemberNumber: () => TE.right([]),
  getTroubleTicketData: () => TE.right(O.none),
} satisfies Dependencies;

describe('delete-event', () => {
  it('deletes an existing event', async () => {
    const eventId = faker.string.uuid() as UUID;
    const actor = arbitraryActor();
    const reason = 'cleanup' as NonEmptyString;
    const deleteEvent = jest.fn(() =>
      TE.right({
        status: StatusCodes.CREATED as StatusCodes.CREATED,
        message: 'Deleted event',
      })
    );

    const result = await getTaskEitherRightOrFail(
      deleteEventCommand.process({
        command: {
          eventId,
          reason,
          actor,
        },
        deps: {
          ...baseDeps,
          deleteEvent,
          getEventById: () => TE.right(O.some({event_id: eventId} as never)),
          getDeletedEventById: () => TE.right(O.none),
        },
        events: [],
      })
    );

    expect(result).toStrictEqual(O.none);
    expect(deleteEvent).toHaveBeenCalledWith(eventId, actor, reason);
  });

  it('does nothing when the event has already been deleted', async () => {
    const eventId = faker.string.uuid() as UUID;
    const reason = 'cleanup' as NonEmptyString;
    const deleteEvent = jest.fn(() =>
      TE.right({
        status: StatusCodes.CREATED as StatusCodes.CREATED,
        message: 'Deleted event',
      })
    );

    const result = await getTaskEitherRightOrFail(
      deleteEventCommand.process({
        command: {
          eventId,
          reason,
          actor: arbitraryActor(),
        },
        deps: {
          ...baseDeps,
          deleteEvent,
          getEventById: () => TE.right(O.some({} as never)),
          getDeletedEventById: () =>
            TE.right(
              O.some({
                event_id: eventId,
                deletedAt: new Date(),
                deletedBy: arbitraryActor(),
                reason,
              })
            ),
        },
        events: [],
      })
    );

    expect(result).toStrictEqual(O.none);
    expect(deleteEvent).not.toHaveBeenCalled();
  });

  it('fails when the event does not exist', async () => {
    const reason = 'cleanup' as NonEmptyString;
    const failure = getLeftOrFail(
      await deleteEventCommand.process({
        command: {
          eventId: faker.string.uuid() as UUID,
          reason,
          actor: arbitraryActor(),
        },
        deps: {
          ...baseDeps,
          getEventById: () => TE.right(O.none),
          getDeletedEventById: () => TE.right(O.none),
        },
        events: [],
      })()
    );

    expect(failure.status).toStrictEqual(StatusCodes.NOT_FOUND);
  });
});
