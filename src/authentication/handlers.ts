import {RequestHandler} from 'express';
import {Request, Response} from 'express';
import {pipe} from 'fp-ts/lib/function';
import {parseEmailAddressFromBody} from './parse-email-address-from-body';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {publish} from 'pubsub-js';
import passport from 'passport';
import {magicLink} from './magic-link';
import {logInPage} from './log-in-page';
import {checkYourMailPage} from './check-your-mail';
import {oopsPage} from '../templates';
import {StatusCodes} from 'http-status-codes';
import {getUserFromSession} from './get-user-from-session';
import {Dependencies} from '../dependencies';
import {
  html,
  HtmlSubstitution,
  RenderedHtml,
  sanitizeString,
} from '../types/html';

export const logIn =
  (deps: Dependencies) => (req: Request, res: Response<RenderedHtml>) => {
    pipe(
      req.session,
      getUserFromSession(deps),
      O.match(
        () => {
          res.status(StatusCodes.OK).send(logInPage);
        },
        _user => res.redirect('/')
      )
    );
  };

export const logOut = (req: Request, res: Response<RenderedHtml>) => {
  req.session = null;
  res.redirect('/');
};

export const auth = (req: Request, res: Response<RenderedHtml>) => {
  pipe(
    req.body,
    parseEmailAddressFromBody,
    E.mapLeft(() => "You entered something that isn't a valid email address"),
    E.matchW(
      msg =>
        res.status(StatusCodes.BAD_REQUEST).send(oopsPage(sanitizeString(msg))),
      email => {
        publish('send-log-in-link', email);
        res.status(StatusCodes.ACCEPTED).send(checkYourMailPage(email));
      }
    )
  );
};

export const invalidLink =
  (logInPath: HtmlSubstitution) =>
  (req: Request, res: Response<RenderedHtml>) => {
    res
      .status(StatusCodes.UNAUTHORIZED)
      .send(
        oopsPage(
          html`The link you have used is (no longer) valid. Go back to the
            <a href=${logInPath}>log in</a> page.`
        )
      );
  };

export const landing = (req: Request, res: Response<RenderedHtml>) => {
  const index = req.originalUrl.indexOf('?');
  const suffix = index === -1 ? '' : req.originalUrl.slice(index);
  const url = `/auth/callback` + suffix;
  res
    .status(StatusCodes.OK)
    .send(html`
    <!doctype html>
    <html>
    <head><meta http-equiv="refresh" content="0; url='${url}'"></head>
    <body></body>
    </html>
    `);
};

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
export const callback = (invalidLinkPath: string) =>
  passport.authenticate(magicLink.name, {
    failureRedirect: invalidLinkPath,
    successRedirect: '/',
  }) as RequestHandler;
