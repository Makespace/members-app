import {Request, Response} from 'express';
import * as TE from 'fp-ts/TaskEither';
import {queryGet} from '../../src/http/query-get';
import {Query} from '../../src/queries/query';
import {
  CompleteHtmlDocument,
  html,
  HttpResponse,
  safe,
  toLoggedInContent,
} from '../../src/types/html';
import {initTestFramework, TestFramework} from '../read-models/test-framework';
import {arbitraryUser} from '../types/user.helper';

const makeReq = (user: ReturnType<typeof arbitraryUser>): Request =>
  ({
    session: {passport: {user}},
    query: {},
    params: {},
  }) as unknown as Request;

type FakeResponse = Response<CompleteHtmlDocument> & {
  redirect: jest.Mock;
  status: jest.Mock;
  setHeader: jest.Mock;
  send: jest.Mock;
};

const makeRes = (): FakeResponse =>
  ({
    redirect: jest.fn(),
    status: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  }) as unknown as FakeResponse;

describe('queryGet', () => {
  let framework: TestFramework;
  let user = arbitraryUser();

  beforeEach(async () => {
    framework = await initTestFramework();
    user = arbitraryUser();
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: user.memberNumber,
      email: user.emailAddress,
      name: undefined,
      formOfAddress: undefined,
    });
  });

  afterEach(() => {
    framework.close();
  });

  it('builds header navigation for logged-in page content', async () => {
    const getAllAreas = jest.spyOn(
      framework.sharedReadModel.area,
      'getAllMinimal'
    );
    const query: Query = () => () =>
      TE.right(toLoggedInContent(safe('Page'))(html`<p>Page content</p>`));
    const res = makeRes();

    await queryGet(framework.depsForCommands, query)(makeReq(user), res);

    expect(getAllAreas).toHaveBeenCalledTimes(1);
    expect(res.send).toHaveBeenCalledWith(
      expect.stringContaining('Page content')
    );
  });

  it('does not build header navigation for redirects', async () => {
    const getAllAreas = jest.spyOn(
      framework.sharedReadModel.area,
      'getAllMinimal'
    );
    const query: Query = () => () => TE.right(HttpResponse.Redirect('/areas'));
    const res = makeRes();

    await queryGet(framework.depsForCommands, query)(makeReq(user), res);

    expect(getAllAreas).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/areas');
  });

  it('does not build header navigation for raw responses', async () => {
    const getAllAreas = jest.spyOn(
      framework.sharedReadModel.area,
      'getAllMinimal'
    );
    const query: Query = () => () =>
      TE.right(HttpResponse.Raw({body: 'raw data', contentType: 'text/plain'}));
    const res = makeRes();

    await queryGet(framework.depsForCommands, query)(makeReq(user), res);

    expect(getAllAreas).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith('content-type', 'text/plain');
    expect(res.send).toHaveBeenCalledWith('raw data');
  });
});
