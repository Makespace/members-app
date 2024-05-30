import {pipe} from 'fp-ts/lib/function';
import {pageTemplate} from '../../templates';
import {html} from '../../types/html';
import * as O from 'fp-ts/Option';
import {ViewModel} from './view-model';

export const render = (viewModel: ViewModel) =>
  pipe(
    html`<h1>${viewModel.name}</h1>`,
    pageTemplate(viewModel.name, O.some(viewModel.user))
  );
