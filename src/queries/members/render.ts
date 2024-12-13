import {pipe} from 'fp-ts/lib/function';
import {html, joinHtml, sanitizeOption, sanitizeString} from '../../types/html';
import * as N from 'fp-ts/number';
import {contramap, Ord} from 'fp-ts/Ord';
import * as RA from 'fp-ts/ReadonlyArray';
import {ViewModel} from './view-model';
import {getGravatarThumbnail} from '../../templates/avatar';
import {renderMemberNumber} from '../../templates/member-number';
import {Member} from '../../read-models/members';

const ordByMemberNumber: Ord<Member> = pipe(
  N.Ord,
  contramap(member => member.memberNumber)
);

const renderMembers = (viewModel: ViewModel) =>
  pipe(
    viewModel.members,
    RA.sort(ordByMemberNumber),
    RA.map(
      member => html`
        <tr>
          <td>
            ${getGravatarThumbnail(member.gravatarHash, member.memberNumber)}
          </td>
          <td>${renderMemberNumber(member.memberNumber)}</td>
          <td>${sanitizeOption(member.name)}</td>
          <td>${sanitizeString(member.emailAddress)}</td>
        </tr>
      `
    ),
    RA.match(
      () => html` <p>Currently no members</p> `,
      rows => html`
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Member number</th>
              <th>Name</th>
              <th>Email</th>
            </tr>
          </thead>
          <tbody>
            ${joinHtml(rows)}
          </tbody>
        </table>
      `
    )
  );

export const render = (viewModel: ViewModel) => html`
  <h1>Members of Makespace</h1>
  ${renderMembers(viewModel)}
`;
