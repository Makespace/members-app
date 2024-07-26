import {DateTime, IANAZone} from 'luxon';
import {HtmlSubstitution, safe} from '../types/html';

// TODO Do this properly. https://github.com/Makespace/members-app/issues/40
export const displayDate = (date: DateTime | number): HtmlSubstitution =>
  safe(
    (typeof date === 'number' ? DateTime.fromMillis(date) : date)
      .setLocale('en-GB')
      .setZone(new IANAZone('Europe/London'))
      .toLocaleString(DateTime.DATETIME_SHORT)
  );
