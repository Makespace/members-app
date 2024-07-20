import {DateTime} from 'luxon';
import {HtmlSubstitution, safe} from '../types/html';

// TODO Do this properly. https://github.com/Makespace/members-app/issues/40
export const displayDate = (
  date: DateTime | Date | number
): HtmlSubstitution =>
  typeof date === 'number'
    ? safe(DateTime.fromMillis(date).toLocaleString())
    : safe(date.toLocaleString());
