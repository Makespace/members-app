import {Request, Response, Router} from 'express';
import {checkYourMailPage, logInPage, oopsPage} from './pages';
import {pipe} from 'fp-ts/lib/function';
import {parseEmailAddressFromBody} from './parse-email-address-from-body';
import * as E from 'fp-ts/Either';
import PubSub from 'pubsub-js';
import passport from 'passport';
import * as t from 'io-ts';
import {EmailAddressCodec, failure} from './types';
import {Strategy as CustomStrategy} from 'passport-custom';
import jwt from 'jsonwebtoken';
import {Config} from './configuration';
import * as O from 'fp-ts/Option';
import {Dependencies} from './dependencies';

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
    jwt.sign(user, conf.TOKEN_SECRET, {expiresIn: '10m'}),
    token => `${conf.PUBLIC_URL}/auth/callback?token=${token}`
  );

const verifyToken = (token: string, secret: Config['TOKEN_SECRET']) =>
  E.tryCatch(
    () => jwt.verify(token, secret),
    failure('Could not verify token')
  );

const decodeMagicLinkFromQuery = (conf: Config) => (input: unknown) =>
  pipe(
    input,
    MagicLinkQuery.decode,
    E.chainW(({token}) => verifyToken(token, conf.TOKEN_SECRET)),
    E.chainW(User.decode)
  );

export const strategy = (deps: Dependencies, conf: Config) => {
  return new CustomStrategy((req, done) => {
    pipe(
      req.query,
      decodeMagicLinkFromQuery(conf),
      E.match(
        error => {
          deps.logger.info(
            {error},
            'Failed to authenticate user from magic link'
          );
          done(undefined, false);
        },
        user => done(undefined, user)
      )
    );
  });
};

export const configureRoutes = (router: Router) => {
  const logInRoute = '/log-in';
  const invalidLinkRoute = '/auth/invalid-magic-link';

  router.get(logInRoute, (req: Request, res: Response) => {
    res.status(200).send(logInPage);
  });

  router.get('/log-out', (req: Request, res: Response) => {
    req.session = null;
    res.redirect('/');
  });

  router.post('/auth', (req: Request, res: Response) => {
    pipe(
      req.body,
      parseEmailAddressFromBody,
      E.mapLeft(() => "You entered something that isn't a valid email address"),
      E.matchW(
        msg => res.status(400).send(oopsPage(msg)),
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
    passport.authenticate(name, {failureRedirect: invalidLinkRoute}),
    (req: Request, res: Response) => {
      res.redirect('/dashboard');
    }
  );

  router.get(invalidLinkRoute, (req: Request, res: Response) => {
    res
      .status(401)
      .send(
        oopsPage(
          `The link you have used is (no longer) valid. Go back to the <a href=${logInRoute}>log in</a>`
        )
      );
  });
};
