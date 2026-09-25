import {faker} from '@faker-js/faker';
import * as E from 'fp-ts/Either';
import {parseLogInIdentifier} from '../../src/authentication/login/log-in-identifier';

// A member knows one of two things about themselves: the address they joined
// with, or the number on their fob.
describe('what someone typed into the log in box', () => {
  it('reads an email address as an email address', () => {
    expect(parseLogInIdentifier({email: 'someone@example.com'})).toStrictEqual(
      E.right({tag: 'email', email: 'someone@example.com'})
    );
  });

  it('reads digits as a member number', () => {
    expect(parseLogInIdentifier({email: '1234'})).toStrictEqual(
      E.right({tag: 'memberNumber', memberNumber: 1234})
    );
  });

  it('forgives the spaces that come with a copy and paste', () => {
    expect(parseLogInIdentifier({email: '  1234 '})).toStrictEqual(
      E.right({tag: 'memberNumber', memberNumber: 1234})
    );
    expect(parseLogInIdentifier({email: ' someone@example.com '})).toStrictEqual(
      E.right({tag: 'email', email: 'someone@example.com'})
    );
  });

  it.each([
    [''],
    ['   '],
    ['not an address'],
    ['12 34'],
    ['1234a'],
    ['@example.com'],
  ])('refuses %p, which is neither', value => {
    expect(E.isLeft(parseLogInIdentifier({email: value}))).toBe(true);
  });

  it('refuses a body with nothing in it', () => {
    expect(E.isLeft(parseLogInIdentifier({}))).toBe(true);
    expect(E.isLeft(parseLogInIdentifier(undefined))).toBe(true);
    expect(
      E.isLeft(parseLogInIdentifier({email: faker.number.int()}))
    ).toBe(true);
  });
});
