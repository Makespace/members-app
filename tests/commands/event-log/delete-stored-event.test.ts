import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {deleteStoredEventCommand} from '../../../src/commands/event-log/delete-stored-event';
import {getRightOrFail, userActor} from '../../helpers';
import {v4 as uuidv4} from 'uuid';
import {Dependencies} from '../../../src/dependencies';
import {happyPathAdapters} from '../../init-dependencies/happy-path-adapters.helper';
import {NonEmptyString, UUID} from 'io-ts-types';

describe('delete stored event command', () => {
  it('uses dependencies to delete the stored event and returns no domain event', async () => {
    const deps: Dependencies = {
      ...happyPathAdapters,
      deleteStoredEvent: jest.fn(() =>
        TE.right({status: 200 as const, message: 'Deleted stored event'})
      ),
    };
    const actor = userActor();

    const result = getRightOrFail(
      await deleteStoredEventCommand.process({
        command: {
          eventId: uuidv4() as UUID,
          reason: 'Incorrectly committed' as NonEmptyString,
          actor,
        },
        events: [],
        deps,
      })()
    );

    expect(deps.deleteStoredEvent).toHaveBeenCalledWith(
      expect.any(String),
      actor.user.memberNumber,
      'Incorrectly committed'
    );
    expect(result).toStrictEqual(O.none);
  });
});
