import {RequestHandler} from 'express';
import {Request, Response} from 'express';
import {pipe} from 'fp-ts/lib/function';
import {parseEmailAddressFromBody} from './parse-email-address-from-body';
import * as E from 'fp-ts/Either';
import {publish} from 'pubsub-js';
import passport from 'passport';
import {magicLink} from './magic-link';
import {logInPage} from './log-in-page';
import {checkYourMailPage} from './check-your-mail';
import {oopsPage} from '../templates';
import {StatusCodes} from 'http-status-codes';
import { SafeString } from 'handlebars';

export const logIn = (req: Request, res: Response) => {
  res.status(StatusCodes.OK).send(logInPage);
};

export const logOut = (req: Request, res: Response) => {
  req.session = null;
  res.redirect('/');
};

export const auth = (req: Request, res: Response) => {
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
};

export const invalidLink =
  (logInPath: string) => (req: Request, res: Response) => {
    res
      .status(StatusCodes.UNAUTHORIZED)
      .send(
        oopsPage(
          new SafeString(
            `The link you have used is (no longer) valid. Go back to the <a href=${logInPath}>log in</a>`
          )
        )
      );
  };

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
export const callback = (invalidLinkPath: string) =>
  passport.authenticate(magicLink.name, {
    failureRedirect: invalidLinkPath,
    successRedirect: '/',
  }) as RequestHandler;
