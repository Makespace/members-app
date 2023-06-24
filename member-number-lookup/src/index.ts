import express, {Application} from 'express';
import {connectAllPubSubSubscribers} from './pubsub-subscribers';
import {createRouter} from './router';
import {createAdapters} from './adapters';
import passport from 'passport';
import session from 'cookie-session';
import {Strategy as CustomStrategy} from 'passport-custom';
import {pipe} from 'fp-ts/lib/function';
import {parseEmailAddressFromBody} from './parse-email-address-from-body';
import httpLogger from 'pino-http';
import * as E from 'fp-ts/Either';

const port = parseInt(process.env.PORT ?? '8080');

const deps = createAdapters();

const app: Application = express();

app.use(httpLogger({logger: deps.logger}));

app.use(express.urlencoded({extended: true}));

passport.use(
  'magiclink',
  new CustomStrategy((req, done) => {
    pipe(
      req.body,
      parseEmailAddressFromBody,
      E.match(
        error => done(error),
        email => done(undefined, {email})
      )
    );
  })
);

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user: Express.User, done) => {
  done(null, user);
});

app.use(
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  session({
    secret: 'secret',
  })
);

app.use(createRouter());

connectAllPubSubSubscribers(deps);

app.listen(port, () => deps.logger.info({port}, 'Server listening'));
