import {archive} from './archive';
import {archiveForm} from './archive-form';
import {unarchive} from './unarchive';
import {unarchiveForm} from './unarchive-form';

export const mailbox = {
  archive: {
    ...archive,
    ...archiveForm,
  },
  unarchive: {
    ...unarchive,
    ...unarchiveForm,
  },
};
