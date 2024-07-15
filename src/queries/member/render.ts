import Handlebars, {SafeString} from 'handlebars';
import {pageTemplate} from '../../templates';
import {ViewModel} from './view-model';

const RENDER_TEMPLATE = Handlebars.compile(
  `
  {{#if isSelf}}
    <h1 class=ownPageBanner>This is your profile!</h1>
  {{/if}}
  <div class="profile">{{avatar_large member.emailAddress member.memberNumber}}</div>
  <table>
    <caption>
      Details
    </caption>
    <tbody>
      <tr>
        <th scope="row">Member number</th>
        <td> {{member_number member.number}}</td>
      </tr>
      <tr>
        <th scope="row">Email</th>
        <td> {{member.email}}</td>
      </tr>
      <tr>
        <th scope="row">Name</th>
        <td>
          {{optional_detail member.name}}
          {{#if isSelf}}
            <a href="/members/edit-name?member={{member.number}}">Edit</a>
          {{/if}}
        </td>
      </tr>
      <tr>
        <th scope="row">Pronouns</th>
        <td>
          {{optional_detail member.pronouns}}
          {{#if isSelf}}
            <a href="/members/edit-pronouns?member={{member.number}}">Edit</a>
          {{/if}}
        </td>
      </tr>
      <tr>
        <th scope="row">Avatar</th>
        <td>
          {{avatar_thumbnail member.emailAddress member.memberNumber}}
          {{#if isSelf}}
            <a class=externalRedirect href="https://gravatar.com/profile">Edit via Gravatar</a>
          {{/if}}
        </td>
      </tr>
    </tbody>
  </table>
`
);

export const render = (viewModel: ViewModel) =>
  pageTemplate(
    'Member',
    viewModel.loggedInMember
  )(new SafeString(RENDER_TEMPLATE(viewModel)));
