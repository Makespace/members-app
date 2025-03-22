import * as TE from 'fp-ts/TaskEither';
import {User} from '../../types';
import {ViewModel} from './view-model';
import {events, EventName} from '../../types/domain-event';

/**
 * Converts a camel case event name to a human-readable description
 * Example: "MemberTrainedOnEquipment" -> "Member Trained On Equipment"
 */
const createReadableDescription = (eventName: EventName): string => {
  // Insert spaces before uppercase letters and capitalize the first letter
  return eventName.replace(/([A-Z])/g, ' $1').trim();
};

export const constructViewModel =
  () =>
  (user: User): TE.TaskEither<never, ViewModel> => {
    const eventsWithDescriptions = events.map(event => ({
      name: event.type,
      description: createReadableDescription(event.type),
    }));

    return TE.right({
      user,
      events: eventsWithDescriptions,
    });
  };
