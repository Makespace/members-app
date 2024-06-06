import {html} from '../../types/html';
import {ViewModel} from './view-model';

export const render = (viewModel: ViewModel) => html`
  <h1>Members of Makespace</h1>
  ${viewModel.member.email}
`;
