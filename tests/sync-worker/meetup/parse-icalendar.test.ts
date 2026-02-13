import pino from 'pino';
import * as E from 'fp-ts/Either';
import {parseICalendar} from '../../../src/sync-worker/meetup/fetch-meetup-ical';
import {getRightOrFail} from '../../helpers';

const silentLogger = pino({level: 'silent'});

describe('parseICalendar', () => {
  describe('basic parsing', () => {
    it('parses a minimal iCal event', () => {
      const ical = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:event123@meetup.com
SUMMARY:Test Event
DTSTART:20240115T190000Z
DTEND:20240115T210000Z
END:VEVENT
END:VCALENDAR`;

      const result = getRightOrFail(parseICalendar(silentLogger, ical));

      expect(result).toHaveLength(1);
      expect(result[0].uid).toBe('event123@meetup.com');
      expect(result[0].summary).toBe('Test Event');
      expect(result[0].dtstart).toEqual(new Date(Date.UTC(2024, 0, 15, 19, 0, 0)));
      expect(result[0].dtend).toEqual(new Date(Date.UTC(2024, 0, 15, 21, 0, 0)));
      expect(result[0].description).toBeNull();
      expect(result[0].location).toBeNull();
      expect(result[0].url).toBeNull();
    });

    it('parses multiple events', () => {
      const ical = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:event1@meetup.com
SUMMARY:First Event
DTSTART:20240115T190000Z
DTEND:20240115T210000Z
END:VEVENT
BEGIN:VEVENT
UID:event2@meetup.com
SUMMARY:Second Event
DTSTART:20240116T180000Z
DTEND:20240116T200000Z
END:VEVENT
END:VCALENDAR`;

      const result = getRightOrFail(parseICalendar(silentLogger, ical));

      expect(result).toHaveLength(2);
      expect(result[0].uid).toBe('event1@meetup.com');
      expect(result[0].summary).toBe('First Event');
      expect(result[1].uid).toBe('event2@meetup.com');
      expect(result[1].summary).toBe('Second Event');
    });

    it('returns empty array for calendar with no events', () => {
      const ical = `BEGIN:VCALENDAR
VERSION:2.0
END:VCALENDAR`;

      const result = getRightOrFail(parseICalendar(silentLogger, ical));

      expect(result).toHaveLength(0);
    });
  });

  describe('optional fields', () => {
    it('parses description, location, and URL', () => {
      const ical = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:event123@meetup.com
SUMMARY:Test Event
DESCRIPTION:This is a test event description
LOCATION:123 Main St, London
URL:https://meetup.com/events/123
DTSTART:20240115T190000Z
DTEND:20240115T210000Z
END:VEVENT
END:VCALENDAR`;

      const result = getRightOrFail(parseICalendar(silentLogger, ical));

      expect(result[0].description).toBe('This is a test event description');
      expect(result[0].location).toBe('123 Main St, London');
      expect(result[0].url).toBe('https://meetup.com/events/123');
    });
  });

  describe('date formats', () => {
    it('parses dates with TZID parameter', () => {
      const ical = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:event123@meetup.com
SUMMARY:Test Event
DTSTART;TZID=Europe/London:20240115T190000
DTEND;TZID=Europe/London:20240115T210000
END:VEVENT
END:VCALENDAR`;

      const result = getRightOrFail(parseICalendar(silentLogger, ical));

      expect(result[0].dtstart).toEqual(new Date(2024, 0, 15, 19, 0, 0));
      expect(result[0].dtend).toEqual(new Date(2024, 0, 15, 21, 0, 0));
    });

    it('parses all-day events (YYYYMMDD format)', () => {
      const ical = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:event123@meetup.com
SUMMARY:All Day Event
DTSTART:20240115
DTEND:20240116
END:VEVENT
END:VCALENDAR`;

      const result = getRightOrFail(parseICalendar(silentLogger, ical));

      expect(result[0].dtstart).toEqual(new Date(Date.UTC(2024, 0, 15)));
      expect(result[0].dtend).toEqual(new Date(Date.UTC(2024, 0, 16)));
    });

    it('uses DTSTART for DTEND when DTEND is missing', () => {
      const ical = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:event123@meetup.com
SUMMARY:Test Event
DTSTART:20240115T190000Z
END:VEVENT
END:VCALENDAR`;

      const result = getRightOrFail(parseICalendar(silentLogger, ical));

      expect(result[0].dtstart).toEqual(result[0].dtend);
    });
  });

  describe('text escaping', () => {
    it('unescapes newlines in description', () => {
      const ical = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:event123@meetup.com
SUMMARY:Test Event
DESCRIPTION:Line one\\nLine two\\nLine three
DTSTART:20240115T190000Z
DTEND:20240115T210000Z
END:VEVENT
END:VCALENDAR`;

      const result = getRightOrFail(parseICalendar(silentLogger, ical));

      expect(result[0].description).toBe('Line one\nLine two\nLine three');
    });

    it('unescapes commas and semicolons', () => {
      const ical = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:event123@meetup.com
SUMMARY:Test\\, with\\; special chars
DESCRIPTION:Comma\\, and semicolon\\;
DTSTART:20240115T190000Z
DTEND:20240115T210000Z
END:VEVENT
END:VCALENDAR`;

      const result = getRightOrFail(parseICalendar(silentLogger, ical));

      expect(result[0].summary).toBe('Test, with; special chars');
      expect(result[0].description).toBe('Comma, and semicolon;');
    });

    it('unescapes backslashes', () => {
      const ical = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:event123@meetup.com
SUMMARY:Path: C:\\\\Users\\\\test
DTSTART:20240115T190000Z
DTEND:20240115T210000Z
END:VEVENT
END:VCALENDAR`;

      const result = getRightOrFail(parseICalendar(silentLogger, ical));

      expect(result[0].summary).toBe('Path: C:\\Users\\test');
    });
  });

  describe('line folding', () => {
    it('unfolds lines that are split with CRLF and space', () => {
      // iCal spec: folding marker (space/tab after newline) is removed
      // To preserve a space, it must be before the newline
      const ical = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:event123@meetup.com
SUMMARY:This is a very long summary that has been
 folded across multiple lines
DTSTART:20240115T190000Z
DTEND:20240115T210000Z
END:VEVENT
END:VCALENDAR`;

      const result = getRightOrFail(parseICalendar(silentLogger, ical));

      // It's expected that 'beenfolded' has no space. When unfolding
      // this whitespace at the start of the second line is removed.
      // If a space is needed one is added before the CRLF.
      expect(result[0].summary).toBe(
        'This is a very long summary that has beenfolded across multiple lines'
      );
    });

    it('unfolds lines that are split with CRLF and tab', () => {
      const ical = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:event123@meetup.com
SUMMARY:Folded with
\ttab character
DTSTART:20240115T190000Z
DTEND:20240115T210000Z
END:VEVENT
END:VCALENDAR`;

      const result = getRightOrFail(parseICalendar(silentLogger, ical));

      // It's expected that 'beenfolded' has no space. When unfolding
      // this whitespace at the start of the second line is removed.
      // If a space is needed one is added before the CRLF.
      expect(result[0].summary).toBe('Folded withtab character');
    });
  });

  describe('error handling', () => {
    it('skips events missing UID', () => {
      const ical = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:Event without UID
DTSTART:20240115T190000Z
DTEND:20240115T210000Z
END:VEVENT
BEGIN:VEVENT
UID:valid@meetup.com
SUMMARY:Valid Event
DTSTART:20240115T190000Z
DTEND:20240115T210000Z
END:VEVENT
END:VCALENDAR`;

      const result = getRightOrFail(parseICalendar(silentLogger, ical));

      expect(result).toHaveLength(1);
      expect(result[0].uid).toBe('valid@meetup.com');
    });

    it('skips events missing SUMMARY', () => {
      const ical = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:nosummary@meetup.com
DTSTART:20240115T190000Z
DTEND:20240115T210000Z
END:VEVENT
BEGIN:VEVENT
UID:valid@meetup.com
SUMMARY:Valid Event
DTSTART:20240115T190000Z
DTEND:20240115T210000Z
END:VEVENT
END:VCALENDAR`;

      const result = getRightOrFail(parseICalendar(silentLogger, ical));

      expect(result).toHaveLength(1);
      expect(result[0].uid).toBe('valid@meetup.com');
    });

    it('skips events missing DTSTART', () => {
      const ical = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:nostart@meetup.com
SUMMARY:Event without start
DTEND:20240115T210000Z
END:VEVENT
BEGIN:VEVENT
UID:valid@meetup.com
SUMMARY:Valid Event
DTSTART:20240115T190000Z
DTEND:20240115T210000Z
END:VEVENT
END:VCALENDAR`;

      const result = getRightOrFail(parseICalendar(silentLogger, ical));

      expect(result).toHaveLength(1);
      expect(result[0].uid).toBe('valid@meetup.com');
    });
  });

  describe('CRLF handling', () => {
    it('handles Windows-style CRLF line endings', () => {
      const ical =
        'BEGIN:VCALENDAR\r\n' +
        'VERSION:2.0\r\n' +
        'BEGIN:VEVENT\r\n' +
        'UID:event123@meetup.com\r\n' +
        'SUMMARY:Test Event\r\n' +
        'DTSTART:20240115T190000Z\r\n' +
        'DTEND:20240115T210000Z\r\n' +
        'END:VEVENT\r\n' +
        'END:VCALENDAR\r\n';

      const result = getRightOrFail(parseICalendar(silentLogger, ical));

      expect(result).toHaveLength(1);
      expect(result[0].uid).toBe('event123@meetup.com');
    });
  });
});
