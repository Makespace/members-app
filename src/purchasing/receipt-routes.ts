import {Request, Response} from 'express';
import expressAsyncHandler from 'express-async-handler';
import multer from 'multer';
import * as t from 'io-ts';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {UUID} from 'io-ts-types';
import {StatusCodes} from 'http-status-codes';
import {v4} from 'uuid';
import {Dependencies} from '../dependencies';
import {Route, get, post} from '../types/route';
import {getUserFromSession} from '../authentication';
import {logInPath} from '../authentication/login/routes';
import {rememberReturnTo} from '../authentication/login/return-to';
import {oopsPage} from '../templates';
import {sanitizeString} from '../types/html';
import {path} from '../types/path';
import {Actor} from '../types/actor';
import {applyCommand} from '../commands/apply-command';
import {uploadReceipt} from '../commands/purchase-request/upload-receipt';
import {requestPath} from '../commands/purchase-request/decide-helpers';
import {canViewReceipts} from './permissions';
import {
  cleanFilename,
  MAX_RECEIPT_FILE_BYTES,
  MAX_RECEIPT_FILES,
  receiptTypeOf,
} from './receipt-files';

const UPLOAD_RECEIPT_PATH = '/purchase-requests/upload-receipt';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_RECEIPT_FILE_BYTES,
    files: MAX_RECEIPT_FILES,
    fields: 10,
  },
});

const fail = (res: Response, status: StatusCodes, message: string) =>
  res.status(status).send(oopsPage(sanitizeString(message)));

const multerMessage = (err: unknown) => {
  if (err instanceof multer.MulterError) {
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        return 'Each file must be no bigger than 10 MB.';
      case 'LIMIT_FILE_COUNT':
      case 'LIMIT_UNEXPECTED_FILE':
        return `Please upload at most ${MAX_RECEIPT_FILES} files at a time.`;
    }
  }
  return 'That upload could not be read.';
};

// The rest of the app posts urlencoded bodies, which Express parses before
// the router; this one is multipart, for the files. Like the Paxton import,
// it only reads the body for a logged-in member. The files are stored first
// and then the event is committed, so a failed commit leaves files nothing
// links to rather than a link to nothing.
const handleUpload = async (deps: Dependencies, req: Request, res: Response) => {
  const files = (req.files ?? []) as ReadonlyArray<Express.Multer.File>;
  const body = req.body as Record<string, unknown>;
  const id = UUID.decode(body.id);
  if (E.isLeft(id)) {
    return fail(res, StatusCodes.BAD_REQUEST, 'Invalid purchase request');
  }
  if (files.length === 0) {
    return fail(
      res,
      StatusCodes.BAD_REQUEST,
      'Please choose a receipt or invoice to upload.'
    );
  }
  const typed = files.map(file => ({file, type: receiptTypeOf(file.buffer)}));
  const notAllowed = typed.find(({type}) => O.isNone(type));
  if (notAllowed) {
    return fail(
      res,
      StatusCodes.BAD_REQUEST,
      `"${cleanFilename(notAllowed.file.originalname)}" isn't a photo or a PDF. Please upload a picture (JPEG, PNG, HEIC...) or a PDF of the receipt or invoice.`
    );
  }
  const user = getUserFromSession(deps)(req.session);
  if (O.isNone(user)) {
    return res.redirect(logInPath);
  }
  const actor: Actor = {tag: 'user', user: user.value};
  const input = {
    id: id.right,
    files: typed.map(({file, type}) => ({
      fileId: v4() as UUID,
      filename: cleanFilename(file.originalname),
      mimeType: O.getOrElse(() => 'application/octet-stream')(type),
      sizeBytes: file.size,
    })),
  };
  if (!uploadReceipt.isAuthorized({actor, rm: deps.sharedReadModel, input})) {
    return fail(
      res,
      StatusCodes.FORBIDDEN,
      'You are not authorized to perform this action'
    );
  }
  try {
    for (const [index, stored] of input.files.entries()) {
      await deps.receiptFiles.store({
        fileId: stored.fileId,
        purchaseRequestId: input.id,
        filename: stored.filename,
        mimeType: stored.mimeType,
        content: typed[index].file.buffer,
      });
    }
  } catch (err) {
    deps.logger.error(err, 'Failed to store purchase receipt files');
    return fail(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      'The receipt could not be saved. Please try again.'
    );
  }
  const result = await applyCommand(deps, uploadReceipt)(input, actor)();
  if (E.isLeft(result)) {
    deps.logger.error(result.left, 'Failed to record uploaded purchase receipts');
    return fail(res, result.left.status, result.left.message);
  }
  return res.redirect(
    pipe(
      t.strict({next: path}).decode(req.query),
      E.map(q => q.next),
      E.getOrElse(() => requestPath(input.id))
    )
  );
};

// Shown in the browser where it can be (images and PDFs); HEIC, which most
// browsers can't show, is downloaded.
const SHOWN_INLINE = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

const handleDownload = async (deps: Dependencies, req: Request, res: Response) => {
  const user = getUserFromSession(deps)(req.session);
  if (O.isNone(user)) {
    // Straight back here after logging in, e.g. from the Treasurer's email.
    rememberReturnTo(req, req.originalUrl);
    return res.redirect(logInPath);
  }
  const requestId = UUID.decode(req.params.id);
  const fileId = UUID.decode(req.params.fileId);
  if (E.isLeft(requestId) || E.isLeft(fileId)) {
    return fail(res, StatusCodes.NOT_FOUND, 'No such receipt');
  }
  const request = deps.sharedReadModel.purchasing.getRequest(requestId.right);
  const receipt = pipe(
    request,
    O.chain(r =>
      O.fromNullable(r.receipts.find(each => each.fileId === fileId.right))
    )
  );
  if (O.isNone(request) || O.isNone(receipt)) {
    return fail(res, StatusCodes.NOT_FOUND, 'No such receipt');
  }
  if (
    !canViewReceipts(
      deps.sharedReadModel,
      deps.conf,
      {tag: 'user', user: user.value},
      request.value
    )
  ) {
    return fail(
      res,
      StatusCodes.FORBIDDEN,
      "Only whoever requested or bought this, its area's purchasers, the Management Team and the Directors can see its receipts."
    );
  }
  const file = await deps.receiptFiles.get(fileId.right);
  if (O.isNone(file) || file.value.purchaseRequestId !== requestId.right) {
    return fail(res, StatusCodes.NOT_FOUND, 'No such receipt');
  }
  const disposition = SHOWN_INLINE.has(file.value.mimeType)
    ? 'inline'
    : 'attachment';
  res.setHeader('Content-Type', file.value.mimeType);
  res.setHeader(
    'Content-Disposition',
    `${disposition}; filename*=UTF-8''${encodeURIComponent(file.value.filename)}`
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, max-age=3600');
  return res.send(file.value.content);
};

export const receiptRoutes = (deps: Dependencies): ReadonlyArray<Route> => [
  post(UPLOAD_RECEIPT_PATH, (req, res, next) => {
    if (O.isNone(getUserFromSession(deps)(req.session))) {
      res.redirect(logInPath);
      return;
    }
    upload.array('files', MAX_RECEIPT_FILES)(req, res, err => {
      if (err) {
        fail(res, StatusCodes.BAD_REQUEST, multerMessage(err));
        return;
      }
      expressAsyncHandler(async (req: Request, res: Response) => {
        await handleUpload(deps, req, res);
      })(req, res, next);
    });
  }),
  get(
    '/purchase-requests/view/:id/receipts/:fileId',
    expressAsyncHandler(async (req: Request, res: Response) => {
      await handleDownload(deps, req, res);
    })
  ),
];
