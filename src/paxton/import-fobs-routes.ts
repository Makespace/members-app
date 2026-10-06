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
  toLoggedInContent,
  toLoggedInContentWithBackLink,
} from '../types/html';
import {oopsPage} from '../templates';
import {User} from '../types';
import {applyImportPlan} from './apply-plan';
import {decodeExport, parsePaxtonExport} from './parse-export';
import {matchFobs} from './match-fobs';
import {PREVIEW_PATH, UPLOAD_PATH, renderUploadForm} from './render-upload-form';
import {renderPreview} from './render-preview';
import {planFromForm} from './plan-from-form';
import {renderSummary} from './render-summary';

// A Paxton export is ~100 bytes a row; 10 MB is far beyond any membership.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {fileSize: 10 * 1024 * 1024, fieldSize: 10 * 1024 * 1024},
});

// The rest of the app posts urlencoded bodies, which Express parses before
// the router. These pages post multipart (for the file, and so the preview's
// few thousand fields are not bound by the urlencoded body limit), so each
// runs multer first and turns its errors into an oops page.
const withMultipart =
  (parse: RequestHandler, handler: RequestHandler): RequestHandler =>
  (req, res, next) =>
    parse(req, res, err => {
      if (err) {
        res
          .status(StatusCodes.BAD_REQUEST)
          .send(oopsPage(safe('That upload could not be read.')));
        return;
      }
      handler(req, res, next);
    });

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

const confirm =
  (deps: Dependencies, body: Record<string, unknown>) =>
  (user: User): TE.TaskEither<FailureWithStatus, HttpResponse> =>
    pipe(
      mustBeSuperuser(deps.sharedReadModel, user),
      TE.chain(() =>
        TE.fromTask(() =>
          applyImportPlan(deps, {tag: 'user', user}, planFromForm(body))
        )
      ),
      TE.map(summary =>
        pipe(
          renderSummary(summary),
          toLoggedInContent(safe('Import fobs from Paxton'))
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

const exportText = (req: Request): string => {
  if (req.file !== undefined) {
    return decodeExport(req.file.buffer);
  }
  const pasted = (req.body as Record<string, unknown>).csv;
  return typeof pasted === 'string' ? pasted : '';
};

export const importFobsRoutes = (deps: Dependencies): ReadonlyArray<Route> => [
  get(UPLOAD_PATH, expressAsyncHandler(queryGet(deps, uploadForm))),
  post(
    PREVIEW_PATH,
    withMultipart(
      upload.single('file'),
      expressAsyncHandler(
        postPage(deps, req => preview(deps, exportText(req)))
      )
    )
  ),
  post(
    UPLOAD_PATH,
    withMultipart(
      upload.none(),
      expressAsyncHandler(
        postPage(deps, req => confirm(deps, req.body as Record<string, unknown>))
      )
    )
  ),
];
