import {pipe} from 'fp-ts/lib/function';
import {arbitraryUser} from '../../types/user.helper';
import {constructViewModel} from '../../../src/queries/domain-events/construct-view-model';
import * as T from 'fp-ts/Task';
import {getRightOrFail} from '../../helpers';
import {events} from '../../../src/types/domain-event';

describe('domain-events/construct-view-model', () => {
  const loggedInUser = arbitraryUser();

  it('returns all domain events with descriptions', async () => {
    const result = await pipe(
      loggedInUser,
      constructViewModel(),
      T.map(getRightOrFail)
    )();

    // Check that we have the correct number of events
    expect(result.events.length).toBe(events.length);

    // Check that all events have name and description
    for (const event of result.events) {
      expect(event).toHaveProperty('name');
      expect(event).toHaveProperty('description');
      expect(typeof event.name).toBe('string');
      expect(typeof event.description).toBe('string');
    }
  });

  it('creates readable descriptions from event names', async () => {
    const result = await pipe(
      loggedInUser,
      constructViewModel(),
      T.map(getRightOrFail)
    )();

    // Test a few specific cases
    const areaCreatedEvent = result.events.find(
      event => event.name === 'AreaCreated'
    );
    expect(areaCreatedEvent).toBeDefined();
    expect(areaCreatedEvent?.description).toBe('Area Created');

    const memberTrainedEvent = result.events.find(
      event => event.name === 'MemberTrainedOnEquipment'
    );
    expect(memberTrainedEvent).toBeDefined();
    expect(memberTrainedEvent?.description).toBe('Member Trained On Equipment');
  });

  it('includes the user in the view model', async () => {
    const result = await pipe(
      loggedInUser,
      constructViewModel(),
      T.map(getRightOrFail)
    )();

    expect(result.user).toEqual(loggedInUser);
  });
});
