import {deleteEvent, undeleteEvent} from './set-event-deleted-state';

export const eventLog = {
  delete: deleteEvent,
  undelete: undeleteEvent,
};
