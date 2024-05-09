import {Request, Response, Router} from 'express';
import {oopsPage} from '../shared-pages';
import {pipe} from 'fp-ts/lib/function';
import {parseEmailAddressFromBody} from './parse-email-address-from-body';
import * as E from 'fp-ts/Either';
import {publish} from 'pubsub-js';
import passport from 'passport';
import {magicLink} from './magic-link';
import {logInPage} from './log-in-page';
import {StatusCodes} from 'http-status-codes';
import {checkYourMailPage} from './check-your-mail';

export const logInRoute = '/log-in';
const invalidLinkRoute = '/auth/invalid-magic-link';

export const configureAuthRoutes = (router: Router) => {
  router.get(logInRoute, (req: Request, res: Response) => {
    res.status(StatusCodes.OK).send(logInPage);
  });

  router.get('/log-out', (req: Request, res: Response) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    req.session.destroy(() => undefined);
    res.redirect('/');
  });

  router.post('/auth', (req: Request, res: Response) => {
    pipe(
      req.body,
      parseEmailAddressFromBody,
      E.mapLeft(() => "You entered something that isn't a valid email address"),
      E.matchW(
        msg => res.status(StatusCodes.BAD_REQUEST).send(oopsPage(msg)),
        email => {
          publish('send-log-in-link', email);
          res.status(StatusCodes.ACCEPTED).send(checkYourMailPage(email));
        }
      )
    );
  });

  router.get(
    '/auth/callback',
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    passport.authenticate(magicLink.name, {failureRedirect: invalidLinkRoute}),
    (req: Request, res: Response) => {
      res.redirect('/');
    }
  );

  router.get(invalidLinkRoute, (req: Request, res: Response) => {
    res
      .status(StatusCodes.UNAUTHORIZED)
      .send(
        oopsPage(
          `The link you have used is (no longer) valid. Go back to the <a href=${logInRoute}>log in</a>`
        )
      );
  });
};
