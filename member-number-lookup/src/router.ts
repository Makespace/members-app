import express, {Request, Response, Router} from 'express';
import path from 'path';
import {
  checkYourMailPage,
  invalidEmailPage,
  landingPage,
  logInPage,
  notFoundPage,
  profilePage,
} from './pages';
import {pipe} from 'fp-ts/lib/function';
import {parseEmailAddressFromBody} from './parse-email-address-from-body';
import * as E from 'fp-ts/Either';
import PubSub from 'pubsub-js';
import passport from 'passport';
import * as t from 'io-ts';
import {EmailAddressCodec} from './types';

const SessionCodec = t.strict({
  passport: t.strict({
    user: t.strict({
      email: EmailAddressCodec,
    }),
  }),
});

export const createRouter = (): Router => {
  const router = Router();

  router.get('/', (req: Request, res: Response) => {
    res.status(200).send(landingPage);
  });

  router.get('/profile', (req: Request, res: Response) => {
    pipe(
      req.session,
      SessionCodec.decode,
      E.map(session => session.passport.user.email),
      E.map(emailAddress => profilePage({emailAddress})),
      E.matchW(
        () => res.status(400).send('Oops, something went wrong.'),
        page => res.status(200).send(page)
      )
    );
  });

  router.get('/log-in', (req: Request, res: Response) => {
    res.status(200).send(logInPage);
  });

  router.post(
    '/auth/callback',
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    passport.authenticate('magiclink'),
    (req: Request, res: Response) => {
      res.redirect('/profile');
    }
  );

  router.use('/static', express.static(path.resolve(__dirname, './static')));

  router.post('/send-member-number-by-email', (req: Request, res: Response) => {
    pipe(
      req.body,
      parseEmailAddressFromBody,
      E.matchW(
        () => res.status(400).send(invalidEmailPage),
        email => {
          PubSub.publish('send-member-number-to-email', email);
          res.status(200).send(checkYourMailPage(email));
        }
      )
    );
  });

  router.use((req, res) => {
    res.status(404).send(notFoundPage);
  });
  return router;
};
