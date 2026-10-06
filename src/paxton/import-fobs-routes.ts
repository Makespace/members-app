import {Request, RequestHandler, Response} from 'express';
import expressAsyncHandler from 'express-async-handler';
import multer from 'multer';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {Dependencies} from '../dependencies';
import {Route, get, post} from '../types/route';
import {Query} from '../queries/query';
import {queryGet, sendQueryResult} from '../http/query-get';
import {getUserFromSession} from '../authentication';
import {logInPath} from '../authentication/login/routes';
import {mustBeSuperuser} from '../queries/util';
import {FailureWithStatus, failureWithStatus} from '../types/failure-with-status';
import {
  CompleteHtmlDocument,
  HttpResponse,
  safe,
  toLoggedInContentWithBackLink,
} from '../types/html';
import {oopsPage} from '../templates';
import {User} from '../types';
import {ImportRunner, createImportRunner} from './import-runner';
import {decodeExport, parsePaxtonExport} from './parse-export';
import {matchFobs} from './match-fobs';
import {PREVIEW_PATH, STATUS_PATH, UPLOAD_PATH, renderUploadForm} from './render-upload-form';
import {renderPreview} from './render-preview';
import {planFromForm} from './plan-from-form';
import {renderStatus} from './render-summary';

// A Paxton export is ~100 bytes a row; 10 MB is far beyond any membership.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {fileSize: 10 * 1024 * 1024, fieldSize: 10 * 1024 * 1024},
});

// The rest of the app posts urlencoded bodies, which Express parses before
// the router. These pages post multipart (for the file, and so the preview's
// few thousand fields are not bound by the urlencoded body limit), so each
// runs multer itself and turns its errors into an oops page. The body is
// only read once the request is known to come from a logged-in super user,
// so nobody else can have the server buffer an upload.
const withMultipart =
  (deps: Dependencies, parse: RequestHandler, handler: RequestHandler): RequestHandler =>
  (req, res, next) => {
    const user = getUserFromSession(deps)(req.session);
    if (O.isNone(user)) {
      res.redirect(logInPath);
      return;
    }
    const member = deps.sharedReadModel.members.getByMemberNumber(
      user.value.memberNumber
    );
    if (O.isNone(member) || !member.value.isSuperUser) {
      res
        .status(StatusCodes.FORBIDDEN)
        .send(oopsPage(safe('Only super-users can import fobs.')));
      return;
    }
    parse(req, res, err => {
      if (err) {
        res
          .status(StatusCodes.BAD_REQUEST)
          .send(oopsPage(safe('That upload could not be read.')));
        return;
      }
      handler(req, res, next);
    });
  };

const uploadForm: Query = deps => user =>
  pipe(
    mustBeSuperuser(deps.sharedReadModel, user),
    TE.map(() =>
      pipe(
        renderUploadForm(),
        toLoggedInContentWithBackLink(safe('Import fobs from Paxton'), {
          href: '/admin',
          label: 'Admin',
        })
      )
    )
  );

// Parses and matches the export, writing nothing: the page it renders is the
// form whose submission does the recording.
const preview =
  (deps: Dependencies, text: string) =>
  (user: User): TE.TaskEither<FailureWithStatus, HttpResponse> =>
    pipe(
      mustBeSuperuser(deps.sharedReadModel, user),
      TE.chainEitherKW(() =>
        pipe(
          parsePaxtonExport(text),
          E.mapLeft(message =>
            failureWithStatus(message, StatusCodes.BAD_REQUEST)()
          )
        )
      ),
      TE.map(rows =>
        matchFobs(rows, deps.sharedReadModel.members.getAllCore())
      ),
      TE.map(result =>
        pipe(
          renderPreview(result),
          toLoggedInContentWithBackLink(safe('Import fobs from Paxton'), {
            href: UPLOAD_PATH,
            label: 'Upload',
          })
        )
      )
    );

// Starts the import and sends the admin to the status page; see
// import-runner.ts for why it is not applied within this request.
const confirm =
  (deps: Dependencies, runner: ImportRunner, body: Record<string, unknown>) =>
  (user: User): TE.TaskEither<FailureWithStatus, HttpResponse> =>
    pipe(
      mustBeSuperuser(deps.sharedReadModel, user),
      TE.chainEitherKW(() =>
        pipe(
          runner.start(deps, {tag: 'user', user}, planFromForm(body)),
          E.mapLeft(() =>
            failureWithStatus(
              'An import is already running; wait for it to finish, then upload again if anything is left.',
              StatusCodes.BAD_REQUEST
            )()
          )
        )
      ),
      TE.map(() => HttpResponse.Redirect(STATUS_PATH))
    );

const status =
  (runner: ImportRunner): Query =>
  deps =>
  user =>
    pipe(
      mustBeSuperuser(deps.sharedReadModel, user),
      TE.map(() =>
        pipe(
          renderStatus(runner.current()),
          toLoggedInContentWithBackLink(safe('Import fobs from Paxton'), {
            href: '/admin',
            label: 'Admin',
          })
        )
      )
    );

// The two POSTs share the GET handler's shape (logged-in super user, result
// rendered with the usual page chrome) but take their input from the
// multipart body rather than the query string.
const postPage =
  (
    deps: Dependencies,
    respond: (req: Request) => (user: User) => TE.TaskEither<FailureWithStatus, HttpResponse>
  ) =>
  async (req: Request, res: Response<CompleteHtmlDocument>) => {
    const user = getUserFromSession(deps)(req.session);
    if (O.isNone(user)) {
      res.redirect(logInPath);
      return;
    }
    const member = deps.sharedReadModel.members.getByMemberNumber(
      user.value.memberNumber
    );
    if (O.isNone(member)) {
      res.redirect(logInPath);
      return;
    }
    await sendQueryResult(deps)(req, res, user.value, member.value)(
      respond(req)(user.value)
    );
  };

// The file if one was chosen, else whatever was pasted.
const exportText = (req: Request): string => {
  if (req.file !== undefined && req.file.size > 0) {
    return decodeExport(req.file.buffer);
  }
  const pasted = (req.body as Record<string, unknown>).csv;
  return typeof pasted === 'string' ? pasted : '';
};

export const importFobsRoutes = (deps: Dependencies): ReadonlyArray<Route> => {
  const runner = createImportRunner();
  return [
    get(UPLOAD_PATH, expressAsyncHandler(queryGet(deps, uploadForm))),
    get(STATUS_PATH, expressAsyncHandler(queryGet(deps, status(runner)))),
    post(
      PREVIEW_PATH,
      withMultipart(
        deps,
        upload.single('file'),
        expressAsyncHandler(postPage(deps, req => preview(deps, exportText(req))))
      )
    ),
    post(
      UPLOAD_PATH,
      withMultipart(
        deps,
        upload.none(),
        expressAsyncHandler(
          postPage(deps, req =>
            confirm(deps, runner, req.body as Record<string, unknown>)
          )
        )
      )
    ),
  ];
};
