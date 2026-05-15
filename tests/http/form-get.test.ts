import {Request, Response} from 'express';
import * as E from 'fp-ts/Either';
import * as TE from 'fp-ts/TaskEither';
import {StatusCodes} from 'http-status-codes';
import {isAdminOrSuperUser} from '../../src/commands/authentication-helpers/is-admin-or-super-user';
import {formGet} from '../../src/http/form-get';
import {Form} from '../../src/types/form';
import {CompleteHtmlDocument, html, safe, toLoggedInContent} from '../../src/types/html';
import {initTestFramework, TestFramework} from '../read-models/test-framework';
import {arbitraryUser} from '../types/user.helper';

const makeReq = (user = arbitraryUser()): Request =>
  ({
    session: {passport: {user}},
    query: {},
    params: {},
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

const makeForm = (
  overrides: Partial<Form<{message: string}>> = {}
): Form<{message: string}> => ({
  renderForm: viewModel =>
    toLoggedInContent(safe('Form'))(html`<p>${safe(viewModel.message)}</p>`),
  constructForm: () => () => TE.right({message: 'Loaded'}),
  formIsAuthorized: null,
  ...overrides,
});

describe('formGet', () => {
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

  it('awaits async form construction before sending the response', async () => {
    let constructFormWasAwaited = false;

    const form = makeForm({
      renderForm: viewModel =>
        toLoggedInContent(safe('Async Form'))(
          html`<p>${safe(viewModel.message)}</p>`
        ),
      constructForm:
        () =>
        () =>
        async () => {
          await Promise.resolve();
          constructFormWasAwaited = true;
          return E.right({message: 'Loaded asynchronously'});
        },
    });
    const req = makeReq(user);
    const res = makeRes();

    await formGet(framework.depsForCommands, form)(req as never, res as never);

    expect(constructFormWasAwaited).toStrictEqual(true);
    expect(res.redirect).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(
      expect.stringContaining('Loaded asynchronously')
    );
  });

  describe('authorization', () => {
    it('shows a forbidden page and does not construct the form when the user is not authorized', async () => {
      const res = makeRes();
      const constructForm = jest.fn(() => TE.right({message: 'Loaded'}));
      const formIsAuthorized = jest.fn(() => false);
      const form = makeForm({
        constructForm: () => () => constructForm(),
        formIsAuthorized,
      });

      await formGet(framework.depsForCommands, form)(makeReq(user), res);

      expect(formIsAuthorized).toHaveBeenCalledWith({
        actor: {tag: 'user', user},
        rm: framework.sharedReadModel,
      });
      expect(constructForm).not.toHaveBeenCalled();
      expect(res.redirect).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(StatusCodes.FORBIDDEN);
      expect(res.send).toHaveBeenCalledWith(
        expect.stringContaining('You are not authorized to perform this action')
      );
    });

    it('constructs the form when the user is authorized', async () => {
      const res = makeRes();
      const constructForm = jest.fn(() => TE.right({message: 'Authorized'}));
      const formIsAuthorized = jest.fn(() => true);
      const form = makeForm({
        constructForm: () => () => constructForm(),
        formIsAuthorized,
      });

      await formGet(framework.depsForCommands, form)(makeReq(user), res);

      expect(formIsAuthorized).toHaveBeenCalledWith({
        actor: {tag: 'user', user},
        rm: framework.sharedReadModel,
      });
      expect(constructForm).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
      expect(res.send).toHaveBeenCalledWith(
        expect.stringContaining('Authorized')
      );
    });

    it('uses isAdminOrSuperUser to deny a normal member and allow a super user', async () => {
      const superUser = arbitraryUser();
      const normalUserRes = makeRes();
      const superUserRes = makeRes();
      const constructForm = jest.fn(() => TE.right({message: 'Privileged'}));
      const form = makeForm({
        constructForm: () => () => constructForm(),
        formIsAuthorized: isAdminOrSuperUser,
      });

      await framework.commands.memberNumbers.linkNumberToEmail({
        memberNumber: superUser.memberNumber,
        email: superUser.emailAddress,
        name: undefined,
        formOfAddress: undefined,
      });
      await framework.commands.superUser.declare({
        memberNumber: superUser.memberNumber,
      });

      await formGet(framework.depsForCommands, form)(makeReq(user), normalUserRes);
      await formGet(framework.depsForCommands, form)(makeReq(superUser), superUserRes);

      expect(constructForm).toHaveBeenCalledTimes(1);
      expect(normalUserRes.status).toHaveBeenCalledWith(StatusCodes.FORBIDDEN);
      expect(normalUserRes.send).toHaveBeenCalledWith(
        expect.stringContaining('You are not authorized to perform this action')
      );
      expect(superUserRes.status).toHaveBeenCalledWith(StatusCodes.OK);
      expect(superUserRes.send).toHaveBeenCalledWith(
        expect.stringContaining('Privileged')
      );
    });
  });
});
