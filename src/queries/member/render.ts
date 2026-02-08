import {getGravatarProfile, getGravatarThumbnail} from '../../templates/avatar';
import {Html, html, joinHtml, sanitizeOption, sanitizeString} from '../../types/html';
import {TrainingMatrix, ViewModel} from './view-model';
import {
  renderMemberNumber,
  renderMemberNumbers,
} from '../../templates/member-number';
import {memberStatusTag} from '../../templates/member-status';
import {renderOwnerAgreementStatus} from '../shared-render/owner-agreement';
import {renderOwnerStatus} from '../shared-render/owner-status';
import {renderTrainerStatus} from '../shared-render/trainer-status';
import {renderTrainingStatus} from '../shared-render/training-status';
import {otherMemberNumbersTooltip} from '../shared-render/other-member-numbers-tooltip';
import { renderTrainingMatrix } from '../shared-render/training-matrix';

const ownPageBanner = html`<h1>This is your profile!</h1>`;

const editName = (viewModel: ViewModel) =>
  html`<a href="/members/edit-name?member=${viewModel.member.memberNumber}">
    Edit
  </a>`;

const editFormOfAddress = (viewModel: ViewModel) =>
  html`<a
    href="/members/edit-form-of-address?member=${viewModel.member.memberNumber}"
  >
    Edit
  </a>`;

const editAvatar = () =>
  html`<a href="https://gravatar.com/profile">Edit via Gravatar</a>`;

const ifSelf = (viewModel: ViewModel, fragment: Html) =>
  viewModel.isSelf ? fragment : '';

  // <tr>
  //   <th scope="row">Owner of</th>
  //   <td>${renderOwnerStatus(viewModel.member.ownerOf, true)}</td>
  // </tr>
  // ${viewModel.isSuperUser
  //   ? html`<tr>
  //       <th scope="row">Owner agreement</th>
  //       <td>
  //         ${renderOwnerAgreementStatus(
  //           viewModel.member.agreementSigned,
  //           true
  //         )}
  //       </td>
  //     </tr>`
  //   : html``}
  // ${
  //   (viewModel.isSuperUser || viewModel.isSelf) ? 
  //   html`
  //     <tr>
  //       <th scope="row">Equipment Quiz Passes</th>
  //       <td>
  //         ${viewModel.quizResults.equipmentQuizPassedAt}
  //       </td>
  //     </tr>
  //   `: html``
  // }
  // <tr>
  //   <th scope="row">Trainer for</th>
  //   <td>${renderTrainerStatus(viewModel.member.trainerFor)}</td>
  // </tr>
  // <tr>
  //   <th scope="row">Trained on</th>
  //   <td>${renderTrainingStatus(viewModel.member.trainedOn, true)}</td>
  // </tr>

export const render = (viewModel: ViewModel) => html`
  ${ifSelf(viewModel, ownPageBanner)}
  <div class="profile">
    ${getGravatarProfile(
      viewModel.member.gravatarHash,
      viewModel.member.memberNumber
    )}
  </div>
  <table>
    <caption>
      Details
    </caption>
    <tbody>
      <tr>
        <th scope="row">Member number</th>
        <td>${renderMemberNumber(viewModel.member.memberNumber)}</td>
      </tr>
      <tr>
        <th scope="row">Other Member Numbers ${otherMemberNumbersTooltip}</th>
        <td>${renderMemberNumbers(viewModel.member.pastMemberNumbers)}</td>
      </tr>
      <tr>
        <th scope="row">Email</th>
        <td>${sanitizeString(viewModel.member.emailAddress)}</td>
      </tr>
      <tr>
        <th scope="row">
          <p>Name</p>
          <p><small>Used for record keeping</small></p>
        </th>
        <td>
          ${sanitizeOption(viewModel.member.name)}
          ${viewModel.isSuperUser ? html`${editName(viewModel)}` : html``}
        </td>
      </tr>
      <tr>
        <th scope="row">Status</th>
        <td>${memberStatusTag(viewModel.member.status)}</td>
      </tr>
      <tr>
        <th scope="row">
          <p>Form of address</p>
          <p><small>Preferred pronouns or nickname</small></p>
        </th>
        <td>
          ${sanitizeOption(viewModel.member.formOfAddress)}
          ${ifSelf(viewModel, editFormOfAddress(viewModel))}
        </td>
      </tr>
      <tr>
        <th scope="row">Avatar</th>
        <td>
          ${getGravatarThumbnail(
            viewModel.member.gravatarHash,
            viewModel.member.memberNumber
          )}
          ${ifSelf(viewModel, editAvatar())}
        </td>
      </tr>
      ${renderTrainingMatrix(viewModel.trainingMatrix)}
    </tbody>
  </table>
`;
