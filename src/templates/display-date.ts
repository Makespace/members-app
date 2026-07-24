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

const ordinalSuffix = (day: number): string => {
  const withinTeens = day % 100;
  if (withinTeens >= 11 && withinTeens <= 13) {
    return 'th';
  }
  switch (day % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
};

// A long, human date with an ordinal day, e.g. "12th July 2026".
export const displayDateLong = (date: DateTime | number): HtmlSubstitution => {
  const dt = (typeof date === 'number' ? DateTime.fromMillis(date) : date)
    .setLocale('en-GB')
    .setZone(new IANAZone('Europe/London'));
  return safe(`${dt.day}${ordinalSuffix(dt.day)} ${dt.toFormat('MMMM yyyy')}`);
};
