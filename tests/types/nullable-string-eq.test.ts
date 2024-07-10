import {NullableStringEq} from '../../src/types/nullable-string';

describe('NullableStringEq', () => {
  it('null and null', () => {
    expect(NullableStringEq.equals(null, null)).toBeTruthy();
  });
  it('Null and string', () => {
    expect(NullableStringEq.equals(null, 'null')).toBeFalsy();
  });
  it('string and different string', () => {
    expect(NullableStringEq.equals('beans', 'null')).toBeFalsy();
  });
  it('matching strings', () => {
    expect(NullableStringEq.equals('beans', 'beans')).toBeTruthy();
  });
});
