import {deleteEvent} from './delete-event';
import {deleteEventForm} from './delete-event-form';
import {unDeleteEvent} from './undelete-event';
import {undeleteEventForm} from './undelete-event-form';

export const eventLog = {
  delete: {
    ...deleteEvent,
    ...deleteEventForm,
  },
  undelete: {
    ...unDeleteEvent,
    ...undeleteEventForm,
  },
};
