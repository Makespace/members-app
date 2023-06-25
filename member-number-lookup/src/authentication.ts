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

export const name = 'magiclink';

const MagicLinkQueryCodec = t.strict({
  token: t.string,
});

const MagicLinkTokenCodec = t.strict({
  emailAddress: EmailAddressCodec,
  memberNumber: t.number,
});

type MagicLinkToken = t.TypeOf<typeof MagicLinkTokenCodec>;

export const createMagicLink = (payload: MagicLinkToken) =>
  pipe(
    jwt.sign(payload, 'secret'),
    token => `http://localhost:8080/auth/callback?token=${token}`
  );

const decodeMagicLinkFromQuery = (tokenSecret: string) => (input: unknown) =>
  pipe(
    input,
    MagicLinkQueryCodec.decode,
    E.map(({token}) => jwt.verify(token, tokenSecret)),
    E.chain(MagicLinkTokenCodec.decode)
  );

export const strategy = (tokenSecret: string) => {
  return new CustomStrategy((req, done) => {
    pipe(
      req.query,
      decodeMagicLinkFromQuery(tokenSecret),
      E.match(
        error => done(error),
        user => done(undefined, {email: user.emailAddress})
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
