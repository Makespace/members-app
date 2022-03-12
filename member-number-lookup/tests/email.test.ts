import * as E from 'fp-ts/Either';
import {EmailCodec} from '../src/email';

describe('email', () => {
  describe('when given an empty string', () => {
    const result = EmailCodec.decode('');
    it('returns Left', () => {
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
