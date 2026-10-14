import express from 'express';
import {
  cookieSessionPassportWorkaround,
  sessionMiddleware,
} from '../../src/authentication';
import {Config} from '../../src/configuration';
import {
  isTroubleTicketsImagePath,
  troubleTicketsImageRoute,
} from '../../src/eink/equipment-trouble-tickets-handler';
import {serve} from '../eink/serve';

const conf = {
  SESSION_SECRET: 'not-a-real-secret',
  PUBLIC_URL: 'http://localhost:8080',
} as Config;

// The same middleware, in the same order, as src/index.ts.
const app = () => {
  const application = express();
  application.use(sessionMiddleware(conf, isTroubleTicketsImagePath));
  application.use(cookieSessionPassportWorkaround);
  application.get(troubleTicketsImageRoute, (req, res) => {
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

  describe('for a display fetching a trouble-ticket image', () => {
    it('sets no cookie', async () => {
      const response = await server.get(
        '/equipment/wood-shop-band-saw/trouble-tickets.png?width=1280&height=720'
      );
      expect(response.headers['set-cookie']).toBeUndefined();
    });

    it('gives the request no session', async () => {
      const response = await server.get(
        '/equipment/wood-shop-band-saw/trouble-tickets.png'
      );
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

describe('isTroubleTicketsImagePath', () => {
  it.each([
    '/equipment/wood-shop-band-saw/trouble-tickets.png',
    '/equipment/7f1c5a52-6b1e-4f0e-9d0e-2a1f4c9b3d11/trouble-tickets.png',
    '/Equipment/wood-shop-band-saw/Trouble-Tickets.PNG',
    '/equipment/wood-shop-band-saw/trouble-tickets.png/',
  ])('matches %s, as the route does', path => {
    expect(isTroubleTicketsImagePath(path)).toBe(true);
  });

  it.each([
    '/equipment/wood-shop-band-saw',
    '/equipment/wood-shop-band-saw/training',
    '/equipment/a/b/trouble-tickets.png',
    '/equipment//trouble-tickets.png',
    '/equipment/wood-shop-band-saw/trouble-tickets.pngx',
  ])('does not match %s', path => {
    expect(isTroubleTicketsImagePath(path)).toBe(false);
  });
});
