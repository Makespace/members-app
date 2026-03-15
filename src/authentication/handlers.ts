import {RequestHandler} from 'express';
import {Request, Response} from 'express';
import {pipe} from 'fp-ts/lib/function';
import {parseEmailAddressFromBody} from './parse-email-address-from-body';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {publish} from 'pubsub-js';
import passport from 'passport';
import {emailVerificationLink, magicLink} from './magic-link';
import {logInPage} from './log-in-page';
import {checkYourMailPage} from './check-your-mail';
import {oopsPage, isolatedPageTemplate} from '../templates';
import {StatusCodes} from 'http-status-codes';
import {getUserFromSession} from './get-user-from-session';
import {Dependencies} from '../dependencies';
import {Config} from '../configuration';
import {
  html,
  HtmlSubstitution,
  CompleteHtmlDocument,
  sanitizeString,
  safe,
} from '../types/html';
import {verifyEmail} from '../commands/members/verify-email';

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
  (linkPath: HtmlSubstitution, copy?: HtmlSubstitution) =>
  (req: Request, res: Response<CompleteHtmlDocument>) => {
    res
      .status(StatusCodes.UNAUTHORIZED)
      .send(
        oopsPage(
          copy ??
            html`The link you have used is (no longer) valid. Go back to the
              <a href=${linkPath}>log in</a> page.`
        )
      );
  };

export const landing =
  (callbackPath: string) =>
  (req: Request, res: Response<CompleteHtmlDocument>) => {
    const index = req.originalUrl.indexOf('?');
    const suffix = index === -1 ? '' : req.originalUrl.slice(index);
    const url = callbackPath + suffix;
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

export const verifyEmailCallback =
  (deps: Dependencies, conf: Config, invalidLinkPath: string): RequestHandler =>
  (req, res) => {
    pipe(
      req.query,
      emailVerificationLink.decodeFromQuery(deps.logger, conf),
      E.match(
        error => {
          deps.logger.info(
            {error},
            'Failed to decode email verification link'
          );
          res.redirect(invalidLinkPath);
        },
        payload => {
          const input = {
            memberNumber: payload.memberNumber,
            email: payload.emailAddress,
          };
          const resource = verifyEmail.resource(input);
          void pipe(
            deps.getResourceEvents(resource),
            TE.chain(({events, version}) => {
              const event = verifyEmail.process({
                command: {
                  ...input,
                  actor: {tag: 'system'},
                },
                events,
              });
              if (O.isNone(event)) {
                return TE.right(undefined);
              }
              return pipe(
                deps.commitEvent(resource, version)(event.value),
                TE.map(() => undefined)
              );
            }),
            TE.match(
              failure => {
                deps.logger.error(
                  {failure},
                  'Failed to verify member email from callback'
                );
                res.redirect(invalidLinkPath);
              },
              () => {
                res.redirect('/me');
              }
            )
          )();
        }
      )
    );
  };
