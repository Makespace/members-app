import express, {Application} from 'express';
import {connectAllPubSubSubscribers} from './pubsub-subscribers';
import {createRouter} from './router';
import * as t from 'io-ts';
import {createAdapters} from './adapters';
import passport from 'passport';
import session from 'cookie-session';
import {Strategy as CustomStrategy} from 'passport-custom';
import {pipe} from 'fp-ts/lib/function';
import httpLogger from 'pino-http';
import * as E from 'fp-ts/Either';
import jwt from 'jsonwebtoken';
import {EmailAddressCodec} from './types';

const port = parseInt(process.env.PORT ?? '8080');

const deps = createAdapters();

const app: Application = express();

app.use(httpLogger({logger: deps.logger}));

app.use(express.urlencoded({extended: true}));

const MagicLinkQueryCodec = t.strict({
  token: t.string,
});

const MagicLinkTokenCodec = t.strict({
  emailAddress: EmailAddressCodec,
  memberNumber: t.number,
});

passport.use(
  'magiclink',
  new CustomStrategy((req, done) => {
    pipe(
      req.query,
      MagicLinkQueryCodec.decode,
      E.map(({token}) => jwt.verify(token, 'secret')),
      E.chain(MagicLinkTokenCodec.decode),
      E.match(
        error => done(error),
        user => done(undefined, {email: user.emailAddress})
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
