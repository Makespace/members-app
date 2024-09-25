import {GoogleTimezone} from '../../src/init-dependencies/google/pull_sheet_data';
import {getRightOrFail} from '../helpers';

describe('Google timezone parse', () => {
  it('Empty default', () => {
    expect(getRightOrFail(GoogleTimezone.decode(''))).toStrictEqual(
      'Europe/London'
    );
  });
  it('Malformed default', () => {
    expect(getRightOrFail(GoogleTimezone.decode(null))).toStrictEqual(
      'Europe/London'
    );
  });
  it('Known timezone', () => {
    expect(getRightOrFail(GoogleTimezone.decode('Africa/Cairo'))).toStrictEqual(
      'Africa/Cairo'
    );
  });
  it('Unknown timezone', () => {
    expect(
      getRightOrFail(GoogleTimezone.decode('Makespace/Cambridge'))
    ).toStrictEqual('Europe/London');
  });
});
