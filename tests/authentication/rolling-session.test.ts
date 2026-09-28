import {Request, Response} from 'express';
import {rollingSession} from '../../src/authentication/rolling-session';
import {getUserFromSession} from '../../src/authentication/login/get-user-from-session';
import {happyPathAdapters} from '../init-dependencies/happy-path-adapters.helper';

type Session = Record<string, unknown> | null;

const run = (session: Session) => {
  const request = {session} as unknown as Request;
  let called = false;
  rollingSession(request, {} as Response, () => {
    called = true;
  });
  return {session: request.session as Session, called};
};

const loggedIn = () => ({
  passport: {user: {emailAddress: 'someone@example.com', memberNumber: 1234}},
});

const today = () => new Date().toISOString().slice(0, 10);

// The cookie only goes back to the browser when the session changes, and a
// logged-in session never changes by itself - so it is stamped, once a day.
describe('keeping a session alive while it is being used', () => {
  it('stamps the day a logged-in member was last seen', () => {
    const {session} = run(loggedIn());

    expect(session?.seenOn).toBe(today());
  });

  // Every response carrying a Set-Cookie would be wasteful; one a day is
  // enough to keep the thirty days running from the last visit.
  it('leaves a session already stamped today alone', () => {
    const before = {...loggedIn(), seenOn: today()};

    const {session} = run({...before});

    expect(session).toStrictEqual(before);
  });

  it('re-stamps one last seen on another day', () => {
    const {session} = run({...loggedIn(), seenOn: '2020-01-01'});

    expect(session?.seenOn).toBe(today());
  });

  it('leaves an anonymous session empty, so no cookie is set', () => {
    expect(run({}).session).toStrictEqual({});
    expect(run(null).session).toBeNull();
  });

  it('always continues', () => {
    expect(run(loggedIn()).called).toBe(true);
    expect(run(null).called).toBe(true);
  });

  // The stamp travels in the same cookie as the user, so reading the user
  // back out has to be unbothered by it.
  it('does not stop the member being read back out of the session', () => {
    const {session} = run(loggedIn());

    const user = getUserFromSession(happyPathAdapters)(session);

    expect(user).toStrictEqual({
      _tag: 'Some',
      value: {emailAddress: 'someone@example.com', memberNumber: 1234},
    });
  });
});
