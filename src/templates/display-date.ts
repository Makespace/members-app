import {DateTime} from 'luxon';
import {londonDateTime} from '../date-time';
import {HtmlSubstitution, safe} from '../types/html';

export const displayDate = (date: DateTime | Date | number): HtmlSubstitution =>
  safe(
    londonDateTime(date).toLocaleString({
      ...DateTime.DATETIME_SHORT,
      hourCycle: 'h23',
    })
  );

export const displayTime = (date: DateTime | Date | number): HtmlSubstitution =>
  safe(londonDateTime(date).toLocaleString(DateTime.TIME_24_SIMPLE));

// A compact date for cramped table cells, e.g. "1 Jul 26". Pair with
// `displayDate` in a title attribute to keep the full timestamp on hover.
export const displayDateShort = (date: DateTime | Date | number): HtmlSubstitution =>
  safe(londonDateTime(date).toFormat('d LLL yy'));

// Just the day, e.g. "14 Nov 2024" - for when the time of day is noise, such
// as when a subscription started or ended.
export const displayDateOnly = (date: DateTime | number | Date): HtmlSubstitution =>
  safe(londonDateTime(date).toLocaleString(DateTime.DATE_MED));
