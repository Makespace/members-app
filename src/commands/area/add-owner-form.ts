import {flow, pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import {pageTemplate} from '../../templates';
import * as O from 'fp-ts/Option';
import {DomainEvent, MemberDetails, User} from '../../types';
import * as t from 'io-ts';
import {StatusCodes} from 'http-status-codes';
import {formatValidationErrors} from 'io-ts-reporters';
import {
  FailureWithStatus,
  failureWithStatus,
} from '../../types/failure-with-status';
import {Form} from '../../types/form';
import {AreaOwners} from '../../read-models/members/get-potential-owners';
import {readModels} from '../../read-models';
import Handlebars, {SafeString} from 'handlebars';

type ViewModel = {
  user: User;
  areaId: string;
  areaOwners: AreaOwners;
};

Handlebars.registerPartial(
  'owner_agreement_invite_button',
  `
    <form action="/send-email/owner-agreement-invite" method="post">
      <input type="hidden" name="recipient" value="{{this.number}}" />
      <button type="submit">Ask to sign</button>
    </form>
`
);

Handlebars.registerHelper('member_name_or_contact', (member: MemberDetails) =>
  O.isSome(member.name) ? member.name : `${member.number} ${member.email}`
);

Handlebars.registerPartial(
  'render_current_owners',
  `
  {{#if areaOwners.existing}}
    Current owners:
    {{#each areaOwners.existing}}
      {{member_name_or_contact this}}
    {{/each}}
  {{else}}
    'No current owners'
  {{/if}}
`
);

Handlebars.registerPartial(
  'render_signed_status',
  `
  {{#if this.agreementSigned}}
    Signed: {{display_date this.agreementSigned}}
  {{else}}
    {{> owner_agreement_invite_button}}
  {{/if}}
  `
);

Handlebars.registerPartial(
  'render_potential_owner',
  `<tr>
        <td>{{this.number}]</td>
        <td>{{this.email}}</td>
        <td>{{> render_signed_status}}</td>
        <td>
          <form action="#" method="post">
            <input type="hidden" name="memberNumber" value="{{this.number}}" />
            <input type="hidden" name="areaId" value="{{areaId}}" />
            <button type="submit">Add</button>
          </form>
        </td>
      </tr>`
);

const ADD_OWNER_FORM_TEMPLATE = Handlebars.compile(
  `
      <h1>Add an owner</h1>
      <p>{{render_current_owners}}</p>
      <div id="wrapper"></div>
      <table id="all-members">
        <thead>
          <tr>
            <th>Member Number</th>
            <th>E-Mail</th>
            <th>Owner Agreement</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {{#each areaOwners.potential}}
            {{> render_potential_owner this areaId=areaId}}
          {{/each}}
        </tbody>
      </table>
      <script>
        new gridjs.Grid({
          from: document.getElementById('all-members'),
          search: true,
          language: {
            search: {
              placeholder: 'Search...',
            },
          },
        }).render(document.getElementById('wrapper'));
      </script>
    `
);

const renderForm = (viewModel: ViewModel) =>
  pageTemplate(
    'Add Owner',
    O.some(viewModel.user)
  )(new SafeString(ADD_OWNER_FORM_TEMPLATE(viewModel)));

const paramsCodec = t.strict({
  area: t.string,
});

const getAreaId = (input: unknown) =>
  pipe(
    input,
    paramsCodec.decode,
    E.map(params => params.area),
    E.mapLeft(
      flow(
        formatValidationErrors,
        failureWithStatus(
          'Parameters submitted to the form were invalid',
          StatusCodes.BAD_REQUEST
        )
      )
    )
  );

const getPotentialOwners = (
  events: ReadonlyArray<DomainEvent>,
  areaId: string
) =>
  pipe(
    events,
    readModels.members.getPotentialOwners(areaId),
    E.fromOption(failureWithStatus('No such area', StatusCodes.NOT_FOUND))
  );

const constructForm: Form<ViewModel>['constructForm'] =
  input =>
  ({user, events}): E.Either<FailureWithStatus, ViewModel> =>
    pipe(
      {user},
      E.right,
      E.bind('areaId', () => getAreaId(input)),
      E.bind('areaOwners', ({areaId}) => getPotentialOwners(events, areaId))
    );

export const addOwnerForm: Form<ViewModel> = {
  renderForm,
  constructForm,
};
