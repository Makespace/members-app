import {deleteStoredEventCommand} from './delete-stored-event';
import {deleteStoredEventForm} from './delete-stored-event-form';

export const eventLog = {
  deleteStoredEvent: {
    ...deleteStoredEventCommand,
    ...deleteStoredEventForm,
  },
};
