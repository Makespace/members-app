import {NullableStringEq} from '../../src/types/nullable-string';

describe('NullableStringEq', () => {
  it('null and null', () => {
    expect(NullableStringEq.equals(null, null));
  });
  it('Null and string', () => {
    expect(!NullableStringEq.equals(null, 'null'));
  });
  it('string and different string', () => {
    expect(!NullableStringEq.equals('beans', 'null'));
  });
  it('matching strings', () => {
    expect(NullableStringEq.equals('beans', 'beans'));
  });
});
