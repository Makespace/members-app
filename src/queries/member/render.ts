import {html} from '../../types/html';
import {ViewModel} from './view-model';

const ownPageBanner = '<h1>This is your profile!</h1>';

export const render = (viewModel: ViewModel) => html`
  ${viewModel.isSelf ? ownPageBanner : ''}
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
