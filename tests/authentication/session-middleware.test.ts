import express from 'express';
import {
  cookieSessionPassportWorkaround,
  sessionMiddleware,
} from '../../src/authentication';
import {Config} from '../../src/configuration';
import {
  displayImageRoute,
  isDisplayImagePath,
} from '../../src/eink/display-image-handler';
import {serve} from '../eink/serve';

const conf = {
  SESSION_SECRET: 'not-a-real-secret',
  PUBLIC_URL: 'http://localhost:8080',
} as Config;

// The same middleware, in the same order, as src/index.ts.
const app = () => {
  const application = express();
  application.use(sessionMiddleware(conf, isDisplayImagePath));
  application.use(cookieSessionPassportWorkaround);
  application.get(displayImageRoute, (req, res) => {
    res.send(req.session ? 'session' : 'no session');
  });
  application.get('/me', (req, res) => {
    res.send(req.session ? 'session' : 'no session');
  });
  return application;
};

describe('sessionMiddleware', () => {
  let server: Awaited<ReturnType<typeof serve>>;

  beforeEach(async () => {
    server = await serve(app());
  });

  afterEach(() => server.close());

  describe('for a display fetching its image', () => {
    it('sets no cookie', async () => {
      const response = await server.get(
        '/e-ink/1.png?width=1280&height=720'
      );
      expect(response.headers['set-cookie']).toBeUndefined();
    });

    it('gives the request no session', async () => {
      const response = await server.get('/e-ink/12.png');
      expect(response.body.toString()).toBe('no session');
    });
  });

  describe('for any other page', () => {
    it('still sets the session cookie, as before', async () => {
      const response = await server.get('/me');
      expect(response.headers['set-cookie']).toEqual(
        expect.arrayContaining([expect.stringMatching(/^ms-app-session=/)])
      );
    });

    it('still gives the request a session', async () => {
      const response = await server.get('/me');
      expect(response.body.toString()).toBe('session');
    });
  });
});

describe('isDisplayImagePath', () => {
  it.each(['/e-ink/1.png', '/e-ink/999.png', '/E-Ink/3.PNG', '/e-ink/3.png/'])(
    'matches %s, as the route does',
    path => {
      expect(isDisplayImagePath(path)).toBe(true);
    }
  );

  it.each([
    '/e-ink',
    '/e-ink/assign',
    '/e-ink/unassign',
    '/e-ink/a/1.png',
    '/e-ink/.png',
    '/e-ink/1.pngx',
  ])('does not match %s', path => {
    expect(isDisplayImagePath(path)).toBe(false);
  });
});
