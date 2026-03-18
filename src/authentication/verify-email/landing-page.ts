import {Request, Response} from 'express';
import {isolatedPageTemplate, oopsPage} from '../../templates';
import {StatusCodes} from 'http-status-codes';
import {
  html,
  CompleteHtmlDocument,
  sanitizeString,
  safe,
} from '../../types/html';
import { Dependencies } from '../../dependencies';
import { Config } from '../../configuration';
import { decodeEmailVerificationLink } from './email-verification-link';
import { pipe } from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import { verifyEmail } from '../../commands/members/verify-email';

const invalidLink = () => oopsPage(
  html`The link you have used is (no longer) valid. Go back to your
    <a href=/me>homepage</a>.`
);

export const landing = 
    (deps: Dependencies, conf: Config) =>
    (req: Request, res: Response<CompleteHtmlDocument>) => {
      pipe(
        req,
        decodeEmailVerificationLink(deps.logger, conf),
        E.match(
          error => {
            deps.logger.error(
              {error},
              'Failed to decode verification link'
            );
            return invalidLink()
          },
          decoded => {
            verifyEmail.process({
              command: {
                
              }
            })
          }
        )
      );

};

// TODO - Combine these.

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
