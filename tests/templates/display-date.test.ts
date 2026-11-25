import {DateTime, Settings} from 'luxon';
import {
  displayDate,
  displayDateOnly,
  displayDateShort,
  displayTime,
} from '../../src/templates/display-date';

describe.each(['UTC', 'America/Los_Angeles', 'Asia/Tokyo'])(
  'date displays with server zone %s',
  zone => {
    const originalZone = Settings.defaultZone;
    const originalLocale = Settings.defaultLocale;

    beforeEach(() => {
      Settings.defaultZone = zone;
      Settings.defaultLocale = 'en-US';
    });

    afterEach(() => {
      Settings.defaultZone = originalZone;
      Settings.defaultLocale = originalLocale;
    });

    it.each([
      ['2026-11-13T18:05:00Z', '13/11/2026, 18:05', '18:05'],
      ['2026-07-01T23:05:00Z', '02/07/2026, 00:05', '00:05'],
      ['2026-03-29T00:30:00Z', '29/03/2026, 00:30', '00:30'],
      ['2026-03-29T01:30:00Z', '29/03/2026, 02:30', '02:30'],
    ])('shows %s as UK time', (iso, expectedDate, expectedTime) => {
      const date = new Date(iso);
      for (const value of [date, date.getTime(), DateTime.fromJSDate(date)]) {
        expect(displayDate(value)).toBe(expectedDate);
        expect(displayTime(value)).toBe(expectedTime);
      }
    });

    it('uses the London calendar day for date-only displays', () => {
      const date = new Date('2026-07-01T23:05:00Z');
      expect(displayDateOnly(date)).toBe('2 Jul 2026');
      expect(displayDateShort(date)).toBe('2 Jul 26');
    });
  }
);
