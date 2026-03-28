import {Request, Response} from 'express';
import * as TE from 'fp-ts/TaskEither';
import {formGet} from '../../src/http/form-get';
import {
  html,
  CompleteHtmlDocument,
  sanitizeString,
  toLoggedInContent,
} from '../../src/types/html';
import {Form} from '../../src/types/form';
import {initTestFramework, TestFramework} from '../read-models/test-framework';
import { arbitraryUser } from '../types/user.helper';

describe('formGet', () => {
  const user = arbitraryUser();
  let framework: TestFramework;

  beforeEach(async () => {
    framework = await initTestFramework();
    await framework.commands.memberNumbers.linkNumberToEmail({
      email: user.emailAddress,
      memberNumber: user.memberNumber,
      name: undefined,
      formOfAddress: undefined,
    });
  });

  afterEach(() => {
    framework.close();
  });

  it('responds with a rendered page when the form loads successfully', async () => {
    const form: Form<{message: string}> = {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      constructForm: input => _context => TE.right({message: (input as any)['id']}),
      renderForm: ({message}) => toLoggedInContent(html`Test form`)(html`<p>${sanitizeString(message)}</p>`),
    };
    const req = {
      session: {passport: {user}},
      query: {},
      params: {id: 'hello'},
    } as unknown as Request;
    const res = {
      status: jest.fn(),
      send: jest.fn(),
      redirect: jest.fn(),
    };
    res.status.mockReturnValue(res);
    res.send.mockReturnValue(res);

    await formGet(framework, form)(
      req,
      res as unknown as Response<CompleteHtmlDocument>
    );

    expect(res.redirect).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('hello'));
  });
});
