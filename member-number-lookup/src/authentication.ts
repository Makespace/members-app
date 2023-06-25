import {Request, Response, Router} from 'express';
import {checkYourMailPage, invalidEmailPage, logInPage} from './pages';
import {pipe} from 'fp-ts/lib/function';
import {parseEmailAddressFromBody} from './parse-email-address-from-body';
import * as E from 'fp-ts/Either';
import PubSub from 'pubsub-js';
import passport from 'passport';
import * as t from 'io-ts';
import {EmailAddressCodec} from './types';
import {Strategy as CustomStrategy} from 'passport-custom';
import jwt from 'jsonwebtoken';
import {Config} from './configuration';
import * as O from 'fp-ts/Option';

export const name = 'magiclink';

const MagicLinkQuery = t.strict({
  token: t.string,
});

const User = t.strict({
  emailAddress: EmailAddressCodec,
  memberNumber: t.number,
});

export type User = t.TypeOf<typeof User>;

const SessionCodec = t.strict({
  passport: t.strict({
    user: User,
  }),
});

export const getUserFromSession = (session: unknown): O.Option<User> =>
  pipe(
    session,
    SessionCodec.decode,
    E.map(session => ({
      emailAddress: session.passport.user.emailAddress,
      memberNumber: session.passport.user.memberNumber,
    })),
    O.fromEither
  );

export const createMagicLink = (conf: Config) => (user: User) =>
  pipe(
    jwt.sign(user, conf.TOKEN_SECRET),
    token => `${conf.PUBLIC_URL}/auth/callback?token=${token}`
  );

const decodeMagicLinkFromQuery = (conf: Config) => (input: unknown) =>
  pipe(
    input,
    MagicLinkQuery.decode,
    E.map(({token}) => jwt.verify(token, conf.TOKEN_SECRET)),
    E.chain(User.decode)
  );

export const strategy = (conf: Config) => {
  return new CustomStrategy((req, done) => {
    pipe(
      req.query,
      decodeMagicLinkFromQuery(conf),
      E.match(
        error => done(error),
        user => done(undefined, user)
      )
    );
  });
};

export const configureRoutes = (router: Router) => {
  const logInRoute = '/log-in';

  router.get(logInRoute, (req: Request, res: Response) => {
    res.status(200).send(logInPage);
  });

  router.post('/auth', (req: Request, res: Response) => {
    pipe(
      req.body,
      parseEmailAddressFromBody,
      E.matchW(
        () => res.status(400).send(invalidEmailPage),
        email => {
          PubSub.publish('send-log-in-link', email);
          res.status(200).send(checkYourMailPage(email));
        }
      )
    );
  });

  router.get(
    '/auth/callback',
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    passport.authenticate(name, {failureRedirect: logInRoute}),
    (req: Request, res: Response) => {
      res.redirect('/profile');
    }
  );
};
