import * as O from 'fp-ts/Option';
import {getGravatarProfile, getGravatarThumbnail} from '../../templates/avatar';
import {Html, html, joinHtml, sanitizeOption, sanitizeString} from '../../types/html';
import {ViewModel} from './view-model';
import {
  renderMemberNumber,
  renderMemberNumbers,
} from '../../templates/member-number';
import {memberStatusTag} from '../../templates/member-status';
import {otherMemberNumbersTooltip} from '../shared-render/other-member-numbers-tooltip';
import {renderTrainingMatrix} from '../training-matrix/render';
import {renderOwnerAgreementStatus} from '../shared-render/owner-agreement';
import {MemberEmail} from '../../read-models/shared-state/return-types';

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

const addEmail = (memberNumber: number) => html`
  <a href="/members/add-email?member=${memberNumber}">
    Add email
  </a>
`;

const renderEmailStatus = (
  email: MemberEmail,
  primaryEmailAddress: string
): string => {
  if (email.emailAddress === primaryEmailAddress) {
    return 'Primary';
  }
  if (O.isSome(email.verifiedAt)) {
    return 'Verified';
  }
  return 'Unverified';
};

const renderEmails = (viewModel: ViewModel): Html => {
  const emails = [...viewModel.member.emails].sort((a, b) => {
    const aIsPrimary = a.emailAddress === viewModel.member.primaryEmailAddress;
    const bIsPrimary = b.emailAddress === viewModel.member.primaryEmailAddress;
    if (aIsPrimary && !bIsPrimary) {
      return -1;
    }
    if (!aIsPrimary && bIsPrimary) {
      return 1;
    }
    return a.emailAddress.localeCompare(b.emailAddress);
  });

  return html`
    <div>
      <table>
        <thead>
          <tr>
            <th scope="col">Email</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          ${joinHtml(
            emails.map(
              email => html`
                <tr>
                  <td>${sanitizeString(email.emailAddress)}</td>
                  <td>
                    ${sanitizeString(
                      renderEmailStatus(
                        email,
                        viewModel.member.primaryEmailAddress
                      )
                    )}
                  </td>
                </tr>
              `
            )
          )}
        </tbody>
      </table>
      ${viewModel.isSuperUser
        ? html`<p>${addEmail(viewModel.member.memberNumber)}</p>`
        : html``}
    </div>
  `;
};

const ifSelf = (viewModel: ViewModel, fragment: Html) =>
  viewModel.isSelf ? fragment : '';

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
        <th scope="row">Email addresses</th>
        <td>${renderEmails(viewModel)}</td>
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
      ${viewModel.isSuperUser
        ? html`<tr>
            <th scope="row">Owner agreement</th>
            <td>
              ${renderOwnerAgreementStatus(
                viewModel.member.agreementSigned,
                true
              )}
            </td>
          </tr>`
        : html``}
      ${renderTrainingMatrix(viewModel.trainingMatrix)}
    </tbody>
  </table>
`;
