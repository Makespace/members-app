import {Request, Response} from 'express';
import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import * as t from 'io-ts';
import {StatusCodes} from 'http-status-codes';
import {formPost} from '../../src/http/form-post';
import {Dependencies} from '../../src/dependencies';
import {Command} from '../../src/commands';
import {CompleteHtmlDocument} from '../../src/types/html';
import {arbitraryUser} from '../types/user.helper';

const alwaysOkCommand: Command<Record<string, never>> = {
  decode: t.strict({}).decode,
  isAuthorized: () => true,
  process: () => TE.right(O.none),
};

const makeDeps = (): Dependencies =>
  ({
    logger: {error: jest.fn(), debug: jest.fn()},
    getAllEvents: () => TE.right([]),
    commitEvent: () => () =>
      TE.right({status: StatusCodes.CREATED, message: ''}),
    sharedReadModel: {},
  }) as unknown as Dependencies;

const makeReq = (query: Record<string, unknown>): Request =>
  ({
    session: {passport: {user: arbitraryUser()}},
    body: {},
    query,
  }) as unknown as Request;

type FakeResponse = Response<CompleteHtmlDocument> & {
  redirect: jest.Mock;
  status: jest.Mock;
  send: jest.Mock;
};

const makeRes = (): FakeResponse =>
  ({
    redirect: jest.fn(),
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  }) as unknown as FakeResponse;

describe('formPost redirect on success', () => {
  it('falls back to the provided successTarget when no ?next= query param is present', async () => {
    const res = makeRes();

    await formPost(makeDeps(), alwaysOkCommand, '/members')(makeReq({}), res);

    expect(res.redirect).toHaveBeenCalledWith('/members');
  });

  it('honours a ?next= path so a non-admin signing the owner agreement is sent to /me rather than the admin-only /members page', async () => {
    const res = makeRes();

    await formPost(makeDeps(), alwaysOkCommand, '/members')(
      makeReq({next: '/me'}),
      res
    );

    expect(res.redirect).toHaveBeenCalledWith('/me');
  });

  it('ignores a ?next= value that is not a path and falls back to the successTarget', async () => {
    const res = makeRes();

    await formPost(makeDeps(), alwaysOkCommand, '/members')(
      makeReq({next: 'https://evil.example.com'}),
      res
    );

    expect(res.redirect).toHaveBeenCalledWith('/members');
  });
});
