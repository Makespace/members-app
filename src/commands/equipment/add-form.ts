import {pipe} from 'fp-ts/lib/function';
import * as t from 'io-ts';
import * as E from 'fp-ts/Either';
import {pageTemplate} from '../../templates';
import {html} from '../../types/html';
import * as O from 'fp-ts/Option';
import {User} from '../../types';
import {v4} from 'uuid';
import {Form} from '../../types/form';
import {formatValidationErrors} from 'io-ts-reporters';
import {failureWithStatus} from '../../types/failureWithStatus';
import {StatusCodes} from 'http-status-codes';

type ViewModel = {
  user: User;
  areaId: string;
};

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <h1>Add equipment</h1>
      <form action="#" method="post">
        <label for="name">What is this Equipment called</label>
        <input type="text" name="name" id="name" />
        <input type="hidden" name="id" value="${v4()}" />
        <input type="hidden" name="areaId" value="${viewModel.areaId}" />
        <button type="submit">Confirm and send</button>
      </form>
    `,
    pageTemplate('Create Equipment', O.some(viewModel.user))
  );

export const addForm: Form<ViewModel> = {
  renderForm,
  constructForm:
    input =>
    ({user}) =>
      pipe(
        input,
        t.strict({area: t.string}).decode,
        E.mapLeft(formatValidationErrors),
        E.mapLeft(
          failureWithStatus('Invalid parameters', StatusCodes.BAD_REQUEST)
        ),
        E.map(({area}) => ({
          user,
          areaId: area,
        }))
      ),
};
