import express, {Application} from 'express';
import {connectAllPubSubSubscribers} from './pubsub-subscribers';
import {createRouter} from './router';
import {createAdapters} from './adapters';
import passport from 'passport';
import session from 'cookie-session';
import {Strategy as CustomStrategy} from 'passport-custom';

const port = parseInt(process.env.PORT ?? '8080');

const deps = createAdapters();

const app: Application = express();

app.use(express.urlencoded({extended: true}));

passport.use(
  'magiclink',
  new CustomStrategy((req, done) => {
    done(undefined, {email: 'foo@example.com'});
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
