import {Config} from '../configuration';

export const sessionOptions = (
  conf: Config
): CookieSessionInterfaces.CookieSessionOptions => ({
  name: 'ms-app-session',
  secret: conf.SESSION_SECRET,
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  httpOnly: true,
  sameSite: 'strict',
  secure: conf.PUBLIC_URL.startsWith('https://'),
});
