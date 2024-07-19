import {ViewModel} from './view-model';
import {pageTemplate} from '../../templates';


Handlebars.registerPartial(
  'failed_imports_list',
  `
  <ul>
    {{#each failedImports}}
      <li><b>{{member_number this.memberNumber}}</b> -- {{this.emailAddress}}</li>
    {{/each}}
  </ul>
  `
);

const RENDER_FAILED_IMPORTS_TEMPLATE = Handlebars.compile(`
  <h1>Failed member imports</h1>
  <p>
    During import from the legacy database the following members could not be
    imported because the email address is already used by another member.
  </p>
  {{> failed_imports_list }}
`);

export const render = (viewModel: ViewModel) =>
  pageTemplate(
    'Failed member imports',
    viewModel.user
  )(new SafeString(RENDER_FAILED_IMPORTS_TEMPLATE(viewModel)));
