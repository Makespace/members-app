import expressAsyncHandler from 'express-async-handler';
import {Dependencies} from '../dependencies';
import {flow, pipe} from 'fp-ts/lib/function';
import {sequenceS} from 'fp-ts/lib/Apply';
import {StatusCodes} from 'http-status-codes';
import {oopsPage} from '../templates';
import {failureWithStatus} from '../types/failure-with-status';
import * as TE from 'fp-ts/TaskEither';
import {getUserFromSession} from '../authentication';
import {Actor} from '../types';
import {Request, Response} from 'express';
import * as E from 'fp-ts/Either';
import {formatValidationErrors} from 'io-ts-reporters';
import {html, CompleteHtmlDocument, safe, sanitizeString} from '../types/html';
import {SendEmail} from '../commands';
import {Config} from '../configuration';
import {isolatedPageTemplate} from '../templates/page-template';

const getActorFrom = (session: unknown, deps: Dependencies) =>
  pipe(
    session,
    getUserFromSession(deps),
    TE.fromOption(() =>
      failureWithStatus('You are not logged in', StatusCodes.UNAUTHORIZED)()
    ),
    TE.map(user => ({tag: 'user', user}) satisfies Actor)
  );

const getInput = <T>(body: unknown, command: SendEmail<T>) =>
  pipe(
    body,
    command.decode,
    E.mapLeft(formatValidationErrors),
    E.mapLeft(
      failureWithStatus('Could not decode command', StatusCodes.BAD_REQUEST)
    ),
    TE.fromEither
  );

const emailPost =
  <T>(conf: Config, deps: Dependencies, command: SendEmail<T>) =>
  async (req: Request, res: Response<CompleteHtmlDocument>) => {
    await pipe(
      {
        actor: getActorFrom(req.session, deps),
        input: getInput(req.body, command),
        events: deps.getAllEvents(),
      },
      sequenceS(TE.ApplySeq),
      TE.filterOrElse(command.isAuthorized, () =>
        failureWithStatus(
          'You are not authorized to perform this action',
          StatusCodes.FORBIDDEN
        )()
      ),
      TE.chainEitherK(({input, actor}) =>
        command.constructEmail(conf, deps, actor, input)
      ),
      TE.chain(
        flow(
          deps.sendEmail,
          TE.mapLeft(
            failureWithStatus(
              'Failed to send email',
              StatusCodes.INTERNAL_SERVER_ERROR
            )
          )
        )
      ),
      TE.match(
        failure => {
          deps.logger.error(
            failure,
            'Failed to handle request to send an email'
          );
          res
            .status(failure.status)
            .send(oopsPage(sanitizeString(failure.message)));
        },
        () => {
          res
            .status(200)
            .send(isolatedPageTemplate(safe('Email sent'))(html`Email sent`));
        }
      )
    )();
  };

export const emailHandler =
  (conf: Config, deps: Dependencies) =>
  <T>(path: string, command: SendEmail<T>) => ({
    path: `/send-email/${path}`,
    handler: flow(emailPost, expressAsyncHandler)(conf, deps, command),
    method: 'post' as const,
  });
