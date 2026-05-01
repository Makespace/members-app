import {Int} from 'io-ts';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {StatusCodes} from 'http-status-codes';
import {
  deleteEvent,
  undeleteEvent,
} from '../../../src/commands/event-log/set-event-deleted-state';
import {Dependencies} from '../../../src/dependencies';
import {getLeftOrFail, getTaskEitherRightOrFail, arbitraryActor} from '../../helpers';
import {happyPathAdapters} from '../../init-dependencies/happy-path-adapters.helper';

describe('set-event-deleted-state command', () => {
  it('deletes an event via dependencies and returns no domain event', async () => {
    const setEventDeletedState = jest.fn(() => TE.right(undefined));
    const deps = {
      ...happyPathAdapters,
      setEventDeletedState,
    } satisfies Dependencies;

    const result = await getTaskEitherRightOrFail(
      deleteEvent.process({
        command: {
          eventIndex: 12 as Int,
          actor: arbitraryActor(),
        },
        rm: deps.sharedReadModel,
        deps,
      })
    );

    expect(setEventDeletedState).toHaveBeenCalledWith(12, true);
    expect(result).toStrictEqual(O.none);
  });

  it('undeletes an event via dependencies and returns no domain event', async () => {
    const setEventDeletedState = jest.fn(() => TE.right(undefined));
    const deps = {
      ...happyPathAdapters,
      setEventDeletedState,
    } satisfies Dependencies;

    const result = await getTaskEitherRightOrFail(
      undeleteEvent.process({
        command: {
          eventIndex: 21 as Int,
          actor: arbitraryActor(),
        },
        rm: deps.sharedReadModel,
        deps,
      })
    );

    expect(setEventDeletedState).toHaveBeenCalledWith(21, false);
    expect(result).toStrictEqual(O.none);
  });

  it('fails when command dependencies are unavailable', async () => {
    const failure = getLeftOrFail(
      await deleteEvent.process({
        command: {
          eventIndex: 12 as Int,
          actor: arbitraryActor(),
        },
        rm: happyPathAdapters.sharedReadModel,
      })()
    );

    expect(failure.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(failure.message).toBe(
      'Missing dependencies needed to update event deleted state'
    );
  });
});
