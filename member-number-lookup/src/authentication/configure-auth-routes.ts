import {Request, Response, Router} from 'express';
import {checkYourMailPage, oopsPage} from '../shared-pages';
import {pipe} from 'fp-ts/lib/function';
import {parseEmailAddressFromBody} from './parse-email-address-from-body';
import * as E from 'fp-ts/Either';
import PubSub from 'pubsub-js';
import passport from 'passport';
import {magicLink} from './magic-link';
import {logInPage} from './log-in-page';

export const configureAuthRoutes = (router: Router) => {
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
    passport.authenticate(magicLink.name, {failureRedirect: invalidLinkRoute}),
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
