import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as A from 'fp-ts/Array';
import {pipe} from 'fp-ts/lib/function';
import {Logger} from 'pino';

export type MeetupEvent = {
  uid: string;
  summary: string;
  description: string | null;
  location: string | null;
  dtstart: Date;
  dtend: Date;
  url: string | null;
};

const unfoldLines = (icalString: string): string[] => {
  // iCalendar spec: lines can be folded by inserting CRLF followed by whitespace
  // Unfold by removing CRLF followed by a single whitespace character
  const unfolded = icalString.replace(/\r?\n[ \t]/g, '');
  return unfolded.split(/\r?\n/);
};

const unescapeICalText = (text: string): string =>
  text
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');

const parseICalDate = (value: string): E.Either<string, Date> => {
  // Handle formats: YYYYMMDD, YYYYMMDDTHHMMSS, YYYYMMDDTHHMMSSZ
  // Also handle TZID parameter: DTSTART;TZID=Europe/London:20240115T190000
  const dateStr = value.includes(':') ? value.split(':').pop()! : value;
  const cleanDateStr = dateStr.replace(/[^0-9TZ]/g, '');

  if (cleanDateStr.length === 8) {
    // YYYYMMDD - all day event
    const year = parseInt(cleanDateStr.slice(0, 4), 10);
    const month = parseInt(cleanDateStr.slice(4, 6), 10) - 1;
    const day = parseInt(cleanDateStr.slice(6, 8), 10);
    return E.right(new Date(Date.UTC(year, month, day)));
  }

  if (cleanDateStr.length >= 15) {
    // YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ
    const year = parseInt(cleanDateStr.slice(0, 4), 10);
    const month = parseInt(cleanDateStr.slice(4, 6), 10) - 1;
    const day = parseInt(cleanDateStr.slice(6, 8), 10);
    const hour = parseInt(cleanDateStr.slice(9, 11), 10);
    const minute = parseInt(cleanDateStr.slice(11, 13), 10);
    const second = parseInt(cleanDateStr.slice(13, 15), 10);

    if (cleanDateStr.endsWith('Z')) {
      return E.right(new Date(Date.UTC(year, month, day, hour, minute, second)));
    }
    // If no Z, assume local time (but store as-is for simplicity)
    return E.right(new Date(year, month, day, hour, minute, second));
  }

  return E.left(`Invalid date format: ${value}`);
};

const extractVEvents = (
  lines: string[]
): Array<{[key: string]: string}> => {
  const events: Array<{[key: string]: string}> = [];
  let currentEvent: {[key: string]: string} | null = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      currentEvent = {};
    } else if (line === 'END:VEVENT' && currentEvent) {
      events.push(currentEvent);
      currentEvent = null;
    } else if (currentEvent) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.slice(0, colonIndex);
        const value = line.slice(colonIndex + 1);
        // Handle properties with parameters like DTSTART;TZID=Europe/London:20240115T190000
        const baseKey = key.split(';')[0];
        currentEvent[baseKey] = value;
        // Also store full key for date parsing (to preserve TZID info)
        if (key !== baseKey) {
          currentEvent[`${baseKey}_FULL`] = line;
        }
      }
    }
  }

  return events;
};

const parseVEvent = (
  eventData: {[key: string]: string}
): E.Either<string, MeetupEvent> => {
  const uid = eventData['UID'];
  const summary = eventData['SUMMARY'];
  const dtstartRaw = eventData['DTSTART_FULL'] ?? `DTSTART:${eventData['DTSTART']}`;
  const dtendRaw = eventData['DTEND_FULL'] ?? `DTEND:${eventData['DTEND'] ?? eventData['DTSTART']}`;

  if (!uid) {
    return E.left('Missing UID');
  }
  if (!summary) {
    return E.left('Missing SUMMARY');
  }
  if (!eventData['DTSTART']) {
    return E.left('Missing DTSTART');
  }

  const dtstart = parseICalDate(dtstartRaw);
  const dtend = parseICalDate(dtendRaw);

  if (E.isLeft(dtstart)) {
    return E.left(`Invalid DTSTART: ${dtstart.left}`);
  }
  if (E.isLeft(dtend)) {
    return E.left(`Invalid DTEND: ${dtend.left}`);
  }

  return E.right({
    uid,
    summary: unescapeICalText(summary),
    description: eventData['DESCRIPTION']
      ? unescapeICalText(eventData['DESCRIPTION'])
      : null,
    location: eventData['LOCATION']
      ? unescapeICalText(eventData['LOCATION'])
      : null,
    dtstart: dtstart.right,
    dtend: dtend.right,
    url: eventData['URL'] ?? null,
  });
};

export const parseICalendar = (
  logger: Logger,
  icalString: string
): E.Either<string, MeetupEvent[]> => {
  const lines = unfoldLines(icalString);
  const vevents = extractVEvents(lines);

  if (vevents.length === 0) {
    logger.warn('No VEVENT blocks found in iCal data');
    return E.right([]);
  }

  const results = pipe(
    vevents,
    A.map(parseVEvent),
    A.separate
  );

  if (results.left.length > 0) {
    logger.warn(
      'Failed to parse %d events: %s',
      results.left.length,
      results.left.slice(0, 3).join(', ')
    );
  }

  return E.right(results.right);
};

export const fetchMeetupIcal = (
  logger: Logger,
  url: string
): TE.TaskEither<string, MeetupEvent[]> =>
  pipe(
    TE.tryCatch(
      async () => {
        logger.info('Fetching iCal from %s', url);
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.text();
      },
      reason => `Failed to fetch Meetup iCal: ${(reason as Error).message}`
    ),
    TE.flatMapEither(icalText => parseICalendar(logger, icalText))
  );
