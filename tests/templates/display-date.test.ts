import {DateTime} from 'luxon';
import {displayDateLong} from '../../src/templates/display-date';

const long = (iso: string): string =>
  displayDateLong(DateTime.fromISO(iso, {zone: 'Europe/London'})) as string;

describe('displayDateLong', () => {
  it('formats a date with a full month, year, and ordinal day', () => {
    expect(long('2026-07-12T09:00:00')).toStrictEqual('12th July 2026');
  });

  it('uses the right ordinal suffix', () => {
    expect(long('2026-03-01T09:00:00')).toStrictEqual('1st March 2026');
    expect(long('2026-03-02T09:00:00')).toStrictEqual('2nd March 2026');
    expect(long('2026-03-03T09:00:00')).toStrictEqual('3rd March 2026');
    expect(long('2026-03-04T09:00:00')).toStrictEqual('4th March 2026');
    expect(long('2026-03-21T09:00:00')).toStrictEqual('21st March 2026');
    expect(long('2026-03-22T09:00:00')).toStrictEqual('22nd March 2026');
    expect(long('2026-03-23T09:00:00')).toStrictEqual('23rd March 2026');
  });

  it('uses "th" for the 11th-13th', () => {
    expect(long('2026-03-11T09:00:00')).toStrictEqual('11th March 2026');
    expect(long('2026-03-12T09:00:00')).toStrictEqual('12th March 2026');
    expect(long('2026-03-13T09:00:00')).toStrictEqual('13th March 2026');
  });
});
