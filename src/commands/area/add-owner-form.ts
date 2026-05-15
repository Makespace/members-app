import {flow, pipe} from 'fp-ts/lib/function';
import * as RA from 'fp-ts/ReadonlyArray';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {EmailAddress} from '../../types';
import * as t from 'io-ts';
import {StatusCodes} from 'http-status-codes';
import {formatValidationErrors} from 'io-ts-reporters';
import {
  failureWithStatus,
} from '../../types/failure-with-status';
import {Form} from '../../types/form';
import {
  html,
  joinHtml,
  safe,
  sanitizeString,
  toLoggedInContent,
} from '../../types/html';
import {renderMemberNumber} from '../../templates/member-number';
import {SharedReadModel} from '../../read-models/shared-state';
import {
  areasTable,
} from '../../read-models/shared-state/state';
import {eq} from 'drizzle-orm';
import {renderMembersAsList} from '../../templates/member-link-list';
import {UUID} from 'io-ts-types';

type Member = {
  memberNumber: number;
  emailAddress: EmailAddress;
  name: O.Option<string>;
  agreementSigned: O.Option<Date>;
};

type ViewModel = {
  areaId: string;
  areaOwners: {
    existing: ReadonlyArray<Member>;
    potential: ReadonlyArray<Member>;
  };
  areaName: string;
};

const renderOwnerAgreementInviteButton = (
  memberNumber: Member['memberNumber']
) => html`
  <form action="/send-email/owner-agreement-invite" method="post">
    <input type="hidden" name="recipient" value="${memberNumber}" />
    <button type="submit">Ask to sign</button>
  </form>
`;

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

const renderMemberCell = (member: Member) => {
  const name = pipe(
    member.name,
    O.map(sanitizeString),
    O.getOrElseW(() => safe(member.emailAddress))
  );
  return html` ${name} ${renderMemberNumber(member.memberNumber)} `;
};

const renderAddOwner = (memberNumber: number, areaId: string) => html`
  <form action="#" method="post">
    <input type="hidden" name="memberNumber" value="${memberNumber}" />
    <input type="hidden" name="areaId" value="${safe(areaId)}" />
    <button type="submit">Add</button>
  </form>
`;

const renderPotentialOwner = (areaId: string) => (owner: Member) =>
  html`<tr>
    <td>${renderMemberCell(owner)}</td>
    <td>${renderAddOwner(owner.memberNumber, areaId)}</td>
    <td>${render_signed_status(owner)}</td>
  </tr>`;

const renderBody = (viewModel: ViewModel) => html`
  <h1>Add an owner for '${sanitizeString(viewModel.areaName)}'</h1>
  <h2>Existing owners</h2>
  <p>${renderExisting(viewModel.areaOwners.existing)}</p>
  <h2>Potential owners</h2>
  <table data-gridjs>
    <thead>
      <tr>
        <th>Member</th>
        <th>Action</th>
        <th>Owner Agreement</th>
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
  pipe(viewModel, renderBody, toLoggedInContent(safe('Add Owner')));

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

const getExistingAndPotentialOwners = (
  readModel: SharedReadModel,
  areaId: string
): ViewModel['areaOwners'] => {
  const toMember = (member: {
    memberNumber: number;
    primaryEmailAddress: EmailAddress;
    name: O.Option<string>;
    agreementSigned: O.Option<Date>;
  }) => ({
    memberNumber: member.memberNumber,
    emailAddress: member.primaryEmailAddress,
    name: member.name,
    agreementSigned: member.agreementSigned,
  });
  const existing = pipe(
    readModel.area.get(areaId as UUID),
    O.map(area => area.owners.map(toMember)),
    O.getOrElse<ReadonlyArray<Member>>(() => [])
  );
  const existingMemberNumbers = existing.map(member => member.memberNumber);
  const potential = readModel.members
    .getAll()
    .filter(member => !existingMemberNumbers.includes(member.memberNumber))
    .map(toMember);
  return {
    existing,
    potential,
  };
};

const getAreaName = (db: SharedReadModel['db'], areaId: string) =>
  pipe(
    db
      .select({areaName: areasTable.name})
      .from(areasTable)
      .where(eq(areasTable.id, areaId))
      .get(),
    result => result?.areaName,
    E.fromNullable(
      failureWithStatus(
        'The requested area does not exist',
        StatusCodes.NOT_FOUND
      )()
    )
  );

const constructForm: Form<ViewModel>['constructForm'] =
  input =>
  ({readModel}) =>
    pipe(
      E.Do,
      E.bind('areaId', () => getAreaId(input)),
      E.bind('areaName', ({areaId}) => getAreaName(readModel.db, areaId)),
      E.bind('areaOwners', ({areaId}) =>
        E.right(getExistingAndPotentialOwners(readModel, areaId))
      ),
      TE.fromEither
    );

export const addOwnerForm: Form<ViewModel> = {
  renderForm,
  constructForm,
  formIsAuthorized: null,
};
