import {flow, pipe} from 'fp-ts/lib/function';
import * as RA from 'fp-ts/ReadonlyArray';
import * as E from 'fp-ts/Either';
import {pageTemplate} from '../../templates';
import {html} from '../../types/html';
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

type ViewModel = {
  user: User;
  areaId: string;
  areaOwners: AreaOwners;
};

const renderSignedStatus = (
  member: ViewModel['areaOwners']['potential'][number]
) =>
  pipe(
    member.agreementSigned,
    O.match(
      () => html`
        <form action="/send-email/owner-agreement-invite" method="post">
          <input type="hidden" name="recipient" value="${member.number}" />
          <button type="submit">Ask to sign</button>
        </form>
      `,
      date => `Signed: ${date.toLocaleDateString()}`
    )
  );

const renderCurrent = (owners: ViewModel['areaOwners']['existing']) =>
  pipe(
    owners,
    RA.map(owner =>
      O.isSome(owner.name) ? owner.name.value : `${owner.number} ${owner.email}`
    ),
    RA.match(
      () => 'No current owners',
      identifiers => `Current owners: ${identifiers.join(', ')}`
    )
  );

const renderForm = (viewModel: ViewModel) =>
  pipe(
    viewModel.areaOwners.potential,
    RA.map(
      member =>
        html`<tr>
          <td>${member.number}</td>
          <td>${member.email}</td>
          <td>${renderSignedStatus(member)}</td>
          <td>
            <form action="#" method="post">
              <input
                type="hidden"
                name="memberNumber"
                value="${member.number}"
              />
              <input type="hidden" name="areaId" value="${viewModel.areaId}" />
              <button type="submit">Add</button>
            </form>
          </td>
        </tr>`
    ),
    tableRows => html`
      <h1>Add an owner</h1>
      <p>${renderCurrent(viewModel.areaOwners.existing)}</p>
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
          ${tableRows.join('\n')}
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
    `,
    pageTemplate('Add Owner', O.some(viewModel.user))
  );

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
