import {RequestHandler} from 'express';
import {StatusCodes} from 'http-status-codes';
import {Dependencies} from '../dependencies';
import * as E from 'fp-ts/Either';
import {MeetupEventRow} from '../sync-worker/db/get-meetup-events';

const formatICalDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
};

const escapeICalText = (text: string): string =>
  text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');

const foldLine = (line: string): string => {
  const maxLength = 75;
  if (line.length <= maxLength) {
    return line;
  }
  const parts: string[] = [];
  let remaining = line;
  while (remaining.length > 0) {
    if (parts.length === 0) {
      parts.push(remaining.slice(0, maxLength));
      remaining = remaining.slice(maxLength);
    } else {
      // Continuation lines start with a space
      parts.push(' ' + remaining.slice(0, maxLength - 1));
      remaining = remaining.slice(maxLength - 1);
    }
  }
  return parts.join('\r\n');
};

const generateICalendar = (
  events: ReadonlyArray<MeetupEventRow>
): string => {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MakeSpace//Members App//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:MakeSpace Events',
  ];

  for (const event of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(foldLine(`UID:${event.uid}`));
    lines.push(`DTSTART:${formatICalDate(event.dtstart)}`);
    lines.push(`DTEND:${formatICalDate(event.dtend)}`);
    lines.push(foldLine(`SUMMARY:${escapeICalText(event.summary)}`));
    if (event.description) {
      lines.push(foldLine(`DESCRIPTION:${escapeICalText(event.description)}`));
    }
    if (event.location) {
      lines.push(foldLine(`LOCATION:${escapeICalText(event.location)}`));
    }
    if (event.url) {
      lines.push(foldLine(`URL:${event.url}`));
    }
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
};

export const calendarIcsHandler =
  (deps: Dependencies): RequestHandler =>
  async (req, res) => {
    const events = await deps.getMeetupEvents()();

    if (E.isLeft(events)) {
      deps.logger.error('Failed to get Meetup events: %s', events.left);
      return res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .send('Failed to load calendar');
    }

    const icalContent = generateICalendar(events.right);

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="makespace-events.ics"'
    );
    return res.status(StatusCodes.OK).send(icalContent);
  };
