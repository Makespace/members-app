
import {DateTime} from 'luxon';

export const registerDisplayDateHelper = () => {
  Handlebars.registerHelper('display_date', date => {
    // TODO Do this properly. https://github.com/Makespace/members-app/issues/40
    switch (typeof date) {
      case 'string':
        return date;
      case 'number':
        return DateTime.fromMillis(date).toLocaleString();
      default:
        if (date instanceof DateTime || date instanceof Date) {
          return date.toLocaleString();
        }
        return 'Unknown Date'; // Placeholder.
    }
  });
};
