import express, {Application} from 'express';
import {connectAllPubSubSubscribers} from './pubsub-subscribers';
import {createRouter} from './router';
import {createAdapters} from './adapters';
import passport from 'passport';
import session from 'cookie-session';
import httpLogger from 'pino-http';
import * as magicLinkAuth from './authentication';

// Dependencies and Config
const port = parseInt(process.env.PORT ?? '8080');
const deps = createAdapters();

// Authentication
passport.use(magicLinkAuth.name, magicLinkAuth.strategy('secret'));
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
    secret: 'secret',
  })
);
app.use(createRouter());
connectAllPubSubSubscribers(deps);

// Start application
app.listen(port, () => deps.logger.info({port}, 'Server listening'));
