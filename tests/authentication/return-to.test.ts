import {isLocalPath} from '../../src/authentication/login/return-to';

// After logging in somebody is sent back where they came from - but only
// ever somewhere on this site.
describe('where to return to after logging in', () => {
  it.each([
    '/trouble-tickets/claim?token=abc',
    '/trouble-tickets/raise?equipmentId=123',
    '/',
  ])('accepts a path on this site: %s', path => {
    expect(isLocalPath(path)).toBe(true);
  });

  it.each([
    'https://evil.example/',
    '//evil.example/',
    '/\\evil.example/',
    'javascript:alert(1)',
    '',
    undefined,
    ['/a', '/b'],
  ])('refuses anything else: %p', path => {
    expect(isLocalPath(path)).toBe(false);
  });
});
