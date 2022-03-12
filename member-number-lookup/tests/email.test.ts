import * as E from 'fp-ts/Either';
import {EmailCodec} from '../src/email';

describe('email', () => {
  describe.each([[''], ['foo']])(
    'when given something that is not an email',
    (input: unknown) => {
      const result = EmailCodec.decode(input);
      it.todo('returns Left');
    }
  );

  describe.skip('when given an email', () => {
    const result = EmailCodec.decode('foo@example.com');
    it('returns Right', () => {
      expect(E.isRight(result)).toBe(true);
    });
  });
});
