import {DateTime} from 'luxon';

export const APP_TIME_ZONE = 'Europe/London';

export const londonDateTime = (date: DateTime | Date | number): DateTime =>
  (date instanceof Date
    ? DateTime.fromJSDate(date)
    : typeof date === 'number'
      ? DateTime.fromMillis(date)
      : date
  )
    .setZone(APP_TIME_ZONE)
    .setLocale('en-GB');
