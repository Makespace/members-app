import expressAsyncHandler from 'express-async-handler';
import {Request, Response} from 'express';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import * as t from 'io-ts';
import {sequenceS} from 'fp-ts/lib/Apply';
import {pipe} from 'fp-ts/lib/function';
import {formatValidationErrors} from 'io-ts-reporters';
import {StatusCodes} from 'http-status-codes';
import {getUserFromSession} from '../../authentication';
import {sendEmailVerification as sendEmailVerificationEmail} from '../../authentication/send-email-verification';
import {Config} from '../../configuration';
import {sendEmailVerification} from './send-email-verification';
import {sendEmailVerificationForm} from './send-email-verification-form';
import {Dependencies} from '../../dependencies';
import {oopsPage} from '../../templates';
import {failureWithStatus} from '../../types/failure-with-status';
import {CompleteHtmlDocument, sanitizeString} from '../../types/html';
import {Actor} from '../../types';
import {formGet} from '../../http/form-get';
import {Route} from '../../types/route';

class PathType extends t.Type<string> {
  readonly _tag = 'PathType' as const;

  constructor() {
    super(
      'string',
      (m): m is string => typeof m === 'string' && m.startsWith('/'),
      (m, c) => (this.is(m) ? t.success(m) : t.failure(m, c)),
      t.identity
    );
  }
}

const path = new PathType();
const nextCodec = t.strict({next: path});

const getActorFrom = (session: unknown, deps: Dependencies) =>
  pipe(
    session,
    getUserFromSession(deps),
    TE.fromOption(() =>
      failureWithStatus('You are not logged in', StatusCodes.UNAUTHORIZED)()
    ),
    TE.map(user => ({tag: 'user', user}) satisfies Actor)
  );

const getCommandFrom = (body: unknown) =>
  pipe(
    body,
    sendEmailVerification.decode,
    E.mapLeft(formatValidationErrors),
    E.mapLeft(
      failureWithStatus('Could not decode command', StatusCodes.BAD_REQUEST)
    ),
    TE.fromEither
  );

const postHandler =
  (deps: Dependencies, conf: Config) =>
  async (req: Request, res: Response<CompleteHtmlDocument>) => {
    await pipe(
      {
        actor: getActorFrom(req.session, deps),
        input: getCommandFrom(req.body),
        events: deps.getAllEvents(),
      },
      sequenceS(TE.ApplySeq),
      TE.filterOrElse(sendEmailVerification.isAuthorized, () =>
        failureWithStatus(
          'You are not authorized to perform this action',
          StatusCodes.FORBIDDEN
        )()
      ),
      TE.chain(({actor, input}) => {
        const resource = sendEmailVerification.resource(input);
        return pipe(
          deps.getResourceEvents(resource),
          TE.chain(({events, version}) => {
            const event = sendEmailVerification.process({
              command: {...input, actor},
              events,
            });
            if (O.isNone(event)) {
              return TE.right(undefined);
            }
            return pipe(
              deps.commitEvent(resource, version)(event.value),
              TE.map(() => input)
            );
          }),
          TE.chainW(result => {
            if (result === undefined) {
              return TE.right(undefined);
            }
            return pipe(
              sendEmailVerificationEmail(deps, conf)(
                result.memberNumber,
                result.email
              ),
              TE.mapLeft(
                failureWithStatus(
                  'Failed to send verification email',
                  StatusCodes.INTERNAL_SERVER_ERROR
                )
              ),
              TE.map(() => undefined)
            );
          })
        );
      }),
      TE.match(
        failure => {
          deps.logger.error(
            failure,
            'Failed to handle request to send email verification'
          );
          res
            .status(failure.status)
            .send(oopsPage(sanitizeString(failure.message)));
        },
        () => {
          const redirectTarget = pipe(
            req.query,
            nextCodec.decode,
            E.map(query => query.next),
            E.getOrElse(() => '/me')
          );
          res.redirect(redirectTarget);
        }
      )
    )();
  };

export const sendEmailVerificationRoutes = (
  deps: Dependencies,
  conf: Config
): ReadonlyArray<Route> => [
  {
    path: '/members/send-email-verification',
    method: 'get',
    handler: formGet(deps, sendEmailVerificationForm),
  },
  {
    path: '/members/send-email-verification',
    method: 'post',
    handler: expressAsyncHandler(postHandler(deps, conf)),
  },
];
