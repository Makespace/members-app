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
import {oopsPage, isolatedPageTemplate} from '../templates';
import {StatusCodes} from 'http-status-codes';
import {getUserFromSession} from './get-user-from-session';
import {Dependencies} from '../dependencies';
import {
  html,
  HtmlSubstitution,
  CompleteHtmlDocument,
  sanitizeString,
  safe,
} from '../types/html';

export const logIn =
  (deps: Dependencies) =>
  (req: Request, res: Response<CompleteHtmlDocument>) => {
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

export const logOut = (req: Request, res: Response<CompleteHtmlDocument>) => {
  req.session = null;
  res.redirect('/');
};

export const auth = (req: Request, res: Response<CompleteHtmlDocument>) => {
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
  (req: Request, res: Response<CompleteHtmlDocument>) => {
    res
      .status(StatusCodes.UNAUTHORIZED)
      .send(
        oopsPage(
          html`The link you have used is (no longer) valid. Go back to the
            <a href=${logInPath}>log in</a> page.`
        )
      );
  };

export const landing = (req: Request, res: Response<CompleteHtmlDocument>) => {
  const index = req.originalUrl.indexOf('?');
  const suffix = index === -1 ? '' : req.originalUrl.slice(index);
  const url = '/auth/callback' + suffix;
  res.status(StatusCodes.OK).send(
    isolatedPageTemplate(sanitizeString('Redirecting...'))(html`
      <!doctype html>
      <html>
        <head>
          <meta http-equiv="refresh" content="0; url='${safe(url)}'" />
        </head>
        <body></body>
      </html>
    `)
  );
};

export const callback = (invalidLinkPath: string) =>
  passport.authenticate(magicLink.name, {
    failureRedirect: invalidLinkPath,
    successRedirect: '/',
  }) as RequestHandler;
