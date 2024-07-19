import {DateTime} from 'luxon';
import {Safe, safe} from '../types/html';

export const displayDate = (date: DateTime | number): Safe => {
  // TODO Do this properly. https://github.com/Makespace/members-app/issues/40
  switch (typeof date) {
    case 'number':
      return safe(DateTime.fromMillis(date).toLocaleString());
    default:
      if (date instanceof DateTime) {
        return safe(date.toLocaleString());
      }
      return safe('Unknown Date'); // Placeholder.
  }
};
