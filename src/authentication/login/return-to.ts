import {Request} from 'express';

// Where to send somebody once they have logged in: the page that sent them
// to log in, so a link from an email - or a QR code on a machine - still
// lands where it pointed. The magic link brings them back in the same
// browser, which still has the session cookie this is kept in.

// Only a path on this site, never another site: '//evil.example' is a
// path-shaped address for somewhere else.
export const isLocalPath = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.startsWith('/') &&
  !value.startsWith('//') &&
  !value.startsWith('/\\');

export const rememberReturnTo = (req: Request, path: unknown): void => {
  if (req.session && isLocalPath(path)) {
    req.session.returnTo = path;
  }
};
