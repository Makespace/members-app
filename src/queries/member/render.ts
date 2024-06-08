import {html} from '../../types/html';
import {ViewModel} from './view-model';

export const render = (viewModel: ViewModel) => html`
  <table>
    <caption>
      Details
    </caption>
    <tbody>
      <tr>
        <th scope="row">Member number</th>
        <td>${viewModel.member.memberNumber}</td>
      </tr>
      <tr>
        <th scope="row">Email</th>
        <td>${viewModel.member.email}</td>
      </tr>
    </tbody>
  </table>
`;
