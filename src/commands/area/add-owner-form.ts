import {flow, pipe} from 'fp-ts/lib/function';
import * as RA from 'fp-ts/ReadonlyArray';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {DomainEvent, User} from '../../types';
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
import {html, joinHtml, safe, sanitizeString} from '../../types/html';
import {Member} from '../../read-models/members/member';
import {pageTemplate} from '../../templates';

type ViewModel = {
  user: User;
  areaId: string;
  areaOwners: AreaOwners;
};

const renderOwnerAgreementInviteButton = (
  memberNumber: Member['memberNumber']
) => html`
  <form action="/send-email/owner-agreement-invite" method="post">
    <input type="hidden" name="recipient" value="${memberNumber}" />
    <button type="submit">Ask to sign</button>
  </form>
`;

const renderMember = (member: Member) =>
  O.isSome(member.name)
    ? html`<a href="/member/${member.memberNumber}"
        >${sanitizeString(member.name.value)}<a></a
      ></a>`
    : html`<a href="/member/${member.memberNumber}"
        >${sanitizeString(member.emailAddress)}<a></a
      ></a>`;

const renderMembersAsList = (members: ReadonlyArray<Member>) =>
  pipe(
    members,
    RA.map(renderMember),
    RA.map(item => html` <li>${item}</li> `),
    joinHtml,
    items => html`
      <ul>
        ${items}
      </ul>
    `
  );

const renderExisting = (existing: ViewModel['areaOwners']['existing']) =>
  pipe(
    existing,
    RA.match(() => html`<p>No current owners</p>`, renderMembersAsList)
  );

const render_signed_status = (member: Member) =>
  pipe(
    member.agreementSigned,
    O.match(
      () => renderOwnerAgreementInviteButton(member.memberNumber),
      date => html`Signed: ${safe(date.toLocaleDateString())}`
    )
  );

const renderPotentialOwner = (areaId: string) => (owner: Member) =>
  html`<tr>
    <td>${owner.memberNumber}</td>
    <td>${sanitizeString(owner.emailAddress)}</td>
    <td>${render_signed_status(owner)}</td>
    <td>
      <form action="#" method="post">
        <input type="hidden" name="memberNumber" value="${owner.memberNumber}" />
        <input type="hidden" name="areaId" value="${safe(areaId)}" />
        <button type="submit">Add</button>
      </form>
    </td>
  </tr>`;

const renderBody = (viewModel: ViewModel) => html`
  <h1>Add an owner</h1>
  <h2>Existing owners</h2>
  <p>${renderExisting(viewModel.areaOwners.existing)}</p>
  <h2>Potential owners</h2>
  <table data-gridjs>
    <thead>
      <tr>
        <th>Member Number</th>
        <th>E-Mail</th>
        <th>Owner Agreement</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      ${pipe(
        viewModel.areaOwners.potential,
        RA.map(renderPotentialOwner(viewModel.areaId)),
        joinHtml
      )}
    </tbody>
  </table>
`;

const renderForm = (viewModel: ViewModel) =>
  pipe(viewModel, renderBody, pageTemplate(safe('Add Owner'), viewModel.user));

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
