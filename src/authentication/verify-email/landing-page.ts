import {Request, Response} from 'express';
import {isolatedPageTemplate} from '../../templates';
import {StatusCodes} from 'http-status-codes';
import {
  html,
  CompleteHtmlDocument,
  sanitizeString,
  safe,
} from '../../types/html';
import { Dependencies } from '../../dependencies';
import { Config } from '../../configuration';

export const landing = 
    (deps: Dependencies, conf: Config) =>
    (req: Request, res: Response<CompleteHtmlDocument>) => {
        req.query


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
