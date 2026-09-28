import {RequestHandler} from 'express';

// cookie-session only re-sends the cookie when the session has changed, and a
// logged-in session never changes: the same user, the same member number,
// every request. So the cookie keeps the expiry it was given at login, and a
// member is logged out thirty days after logging in however much they used
// the app in between.
//
// Stamping the day they were last seen makes the thirty days run from their
// last visit instead. The stamp changes at most once a day, so all but one
// response a day still carries no Set-Cookie, and the session codec drops the
// field when it reads the user back out.
export const rollingSession: RequestHandler = (request, _response, next) => {
  const session = request.session as
    | (CookieSessionInterfaces.CookieSessionObject & {seenOn?: string})
    | null
    | undefined;
  if (session && session.passport) {
    const today = new Date().toISOString().slice(0, 10);
    if (session.seenOn !== today) {
      session.seenOn = today;
    }
  }
  next();
};
