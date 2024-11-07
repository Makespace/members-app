import * as E from 'fp-ts/Either';
import {Form} from '../../types/form';
import {pipe} from 'fp-ts/lib/function';
import {html, safe, toLoggedInContent} from '../../types/html';
import {v4} from 'uuid';
import {UUID} from 'io-ts-types';

type ViewModel = unknown;

const renderForm = () =>
  pipe(
    html`
      <h1>Create an area</h1>
      <form action="#" method="post">
        <label for="name">What is this area called</label>
        <input type="text" name="name" id="name" />
        <input type="hidden" name="id" value="${v4() as UUID}" />
        <button type="submit">Confirm and send</button>
      </form>
    `,
    toLoggedInContent(safe('Create Area'))
  );

export const createForm: Form<ViewModel> = {
  renderForm,
  constructForm: () => () => E.right({}),
};
