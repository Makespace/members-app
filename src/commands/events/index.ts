import {deleteEventCommand} from './delete';
import {deleteEventForm} from './delete-form';

export const events = {
  delete: {
    ...deleteEventCommand,
    ...deleteEventForm,
  },
};
