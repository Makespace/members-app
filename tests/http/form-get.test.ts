import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {formGet} from '../../src/http/form-get';
import {Dependencies} from '../../src/dependencies';
import {Form} from '../../src/types/form';
import {html, safe, toLoggedInContent} from '../../src/types/html';
import {arbitraryUser} from '../types/user.helper';

describe('formGet', () => {
  it('awaits async form construction before sending the response', async () => {
    const user = arbitraryUser();
    let constructFormWasAwaited = false;

    const form: Form<{message: string}> = {
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
      formIsAuthorized: null,
    };

    const deps = {
      logger: {
        error: jest.fn(),
        debug: jest.fn(),
      },
      sharedReadModel: {
        members: {
          getByMemberNumber: () => O.some({isSuperUser: false}),
        },
      },
    } as unknown as Dependencies;

    const req = {
      session: {passport: {user}},
      query: {},
      params: {},
    };

    const res = {
      redirect: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    await formGet(deps, form)(req as never, res as never);

    expect(constructFormWasAwaited).toStrictEqual(true);
    expect(res.redirect).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(
      expect.stringContaining('Loaded asynchronously')
    );
  });
});
