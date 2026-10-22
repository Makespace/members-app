import * as E from 'fp-ts/Either';
import {
  formatPence,
  PenceFromPoundsString,
  PositivePenceFromPoundsString,
} from '../../src/types/money';
import {getRightOrFail} from '../helpers';

describe('PenceFromPoundsString', () => {
  it('reads whole pounds', () => {
    expect(getRightOrFail(PenceFromPoundsString.decode('630'))).toStrictEqual(
      63_000
    );
  });

  it('reads pounds and pence', () => {
    expect(
      getRightOrFail(PenceFromPoundsString.decode('630.5'))
    ).toStrictEqual(63_050);
    expect(
      getRightOrFail(PenceFromPoundsString.decode('0.07'))
    ).toStrictEqual(7);
  });

  it('ignores a pound sign, thousands separators and spaces', () => {
    expect(
      getRightOrFail(PenceFromPoundsString.decode(' £1,000.00 '))
    ).toStrictEqual(100_000);
  });

  it('allows zero', () => {
    expect(getRightOrFail(PenceFromPoundsString.decode('0'))).toStrictEqual(0);
  });

  it.each(['', 'abc', '1.234', '-5', '12.', 'NaN'])('refuses %p', input => {
    expect(E.isLeft(PenceFromPoundsString.decode(input))).toBe(true);
  });

  it('refuses a number, which would be ambiguous between pounds and pence', () => {
    expect(E.isLeft(PenceFromPoundsString.decode(630))).toBe(true);
  });
});

describe('PositivePenceFromPoundsString', () => {
  it('reads a positive amount', () => {
    expect(
      getRightOrFail(PositivePenceFromPoundsString.decode('0.01'))
    ).toStrictEqual(1);
  });

  it('refuses zero', () => {
    expect(E.isLeft(PositivePenceFromPoundsString.decode('0.00'))).toBe(true);
  });
});

describe('formatPence', () => {
  it('shows pounds with separators', () => {
    expect(formatPence(123_456)).toStrictEqual('£1,234.56');
  });

  it('keeps the sign of a negative amount', () => {
    expect(formatPence(-1_200)).toStrictEqual('-£12.00');
  });
});
