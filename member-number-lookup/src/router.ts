import express, {Request, Response, Router} from 'express';
import path from 'path';
import {
  checkYourMailPage,
  invalidEmailPage,
  landingPage,
  logInPage,
  notFoundPage,
} from './pages';
import {pipe} from 'fp-ts/lib/function';
import {parseEmailAddressFromBody} from './parse-email-address-from-body';
import * as E from 'fp-ts/Either';
import PubSub from 'pubsub-js';
import passport from 'passport';

export const createRouter = (): Router => {
  const router = Router();

  router.get('/', (req: Request, res: Response) => {
    res.status(200).send(landingPage);
  });

  router.get('/log-in', (req: Request, res: Response) => {
    res.status(200).send(logInPage);
  });

  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  router.post(
    '/auth/callback',
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    passport.authenticate('magiclink'),
    (req: Request, res: Response) => {
      res.redirect('/');
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
