import {archive} from './archive';
import {archiveForm} from './archive-form';
import {unarchive} from './unarchive';
import {unarchiveForm} from './unarchive-form';
import {createTicket} from './create-ticket';
import {createTicketForm} from './create-ticket-form';

export const mailbox = {
  archive: {
    ...archive,
    ...archiveForm,
  },
  unarchive: {
    ...unarchive,
    ...unarchiveForm,
  },
  createTicket: {
    ...createTicket,
    ...createTicketForm,
  },
};
