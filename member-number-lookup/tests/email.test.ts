import * as E from 'fp-ts/Either';
import {EmailCodec} from '../src/types/email';

describe('email', () => {
  describe.each([[''], ['foo'], ['"Bob Example" <bob@example.com>']])(
    'when given something that is not an email',
    (input: unknown) => {
      const result = EmailCodec.decode(input);
      it('returns Left', () => {
        expect(E.isLeft(result)).toBe(true);
      });
    }
  );

  describe('when given an email', () => {
    const result = EmailCodec.decode('foo@example.com');
    it('returns Right', () => {
      expect(E.isRight(result)).toBe(true);
    });
  });
});
