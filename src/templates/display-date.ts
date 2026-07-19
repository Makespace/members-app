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

// A compact date for cramped table cells, e.g. "1 Jul 26". Pair with
// `displayDate` in a title attribute to keep the full timestamp on hover.
export const displayDateShort = (date: DateTime | number): HtmlSubstitution =>
  safe(
    (typeof date === 'number' ? DateTime.fromMillis(date) : date)
      .setLocale('en-GB')
      .setZone(new IANAZone('Europe/London'))
      .toFormat('d LLL yy')
  );
