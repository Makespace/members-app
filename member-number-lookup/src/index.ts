import express, {Application} from 'express';
import {connectAllPubSubSubscribers} from './pubsub-subscribers';
import {createRouter} from './router';
import {createAdapters} from './adapters';
import passport from 'passport';
import session from 'cookie-session';
import httpLogger from 'pino-http';
import * as magicLinkAuth from './authentication';
import {loadConfig} from './configuration';

// Dependencies and Config
const conf = loadConfig();
const deps = createAdapters(conf);

// Authentication
passport.use(magicLinkAuth.name, magicLinkAuth.strategy(conf));
passport.serializeUser((user, done) => {
  done(null, user);
});
passport.deserializeUser((user: Express.User, done) => {
  done(null, user);
});

// Application setup
const app: Application = express();
app.use(httpLogger({logger: deps.logger}));
app.use(express.urlencoded({extended: true}));
app.use(
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  session({
    secret: conf.SESSION_SECRET,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    sameSite: 'strict',
    httpOnly: true,
    secure: conf.PUBLIC_URL.startsWith('https://'),
  })
);
app.use(createRouter());
connectAllPubSubSubscribers(deps, conf);

// Start application
app.listen(conf.PORT, () =>
  deps.logger.info({port: conf.PORT}, 'Server listening')
);
