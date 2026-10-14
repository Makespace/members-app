import {
  mayEmail,
  whoMayBeEmailed,
} from '../../src/trouble-tickets/notification-gate';

describe('who the trouble ticket notifications may be sent to', () => {
  // The safe default: the stack can be deployed and watched with nobody's
  // inbox involved, because an unset variable means nobody.
  it('lets nobody through when nothing is set', () => {
    const audience = whoMayBeEmailed('');

    expect(mayEmail(audience, 'owner@example.com')).toBe(false);
  });

  it('lets nobody through when the setting is only spaces', () => {
    expect(mayEmail(whoMayBeEmailed('   '), 'owner@example.com')).toBe(false);
  });

  it('lets everybody through for "all"', () => {
    const audience = whoMayBeEmailed('all');

    expect(mayEmail(audience, 'owner@example.com')).toBe(true);
    expect(mayEmail(audience, 'anybody@example.com')).toBe(true);
  });

  it('is not fussy about how "all" is written', () => {
    expect(mayEmail(whoMayBeEmailed(' ALL '), 'owner@example.com')).toBe(true);
  });

  it('lets only the named addresses through', () => {
    const audience = whoMayBeEmailed('tester@example.com');

    expect(mayEmail(audience, 'tester@example.com')).toBe(true);
    expect(mayEmail(audience, 'owner@example.com')).toBe(false);
  });

  it('takes a list, however it is spaced', () => {
    const audience = whoMayBeEmailed(
      'one@example.com , two@example.com,,three@example.com'
    );

    expect(mayEmail(audience, 'one@example.com')).toBe(true);
    expect(mayEmail(audience, 'two@example.com')).toBe(true);
    expect(mayEmail(audience, 'three@example.com')).toBe(true);
    expect(mayEmail(audience, 'four@example.com')).toBe(false);
  });

  // Addresses are written down by hand in an environment variable and come
  // back out of the read model however the member typed them.
  it('ignores the case of an address', () => {
    const audience = whoMayBeEmailed('Tester@Example.com');

    expect(mayEmail(audience, 'tester@example.COM')).toBe(true);
  });
});
