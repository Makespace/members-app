import * as tt from 'io-ts-types';
import * as t from 'io-ts';
import * as E from 'fp-ts/Either';
import {EmailAddress} from '../../types';
import {Form} from '../../types/form';
import {flow, pipe} from 'fp-ts/lib/function';
import {html, safe, sanitizeString, toLoggedInContent} from '../../types/html';
import {StatusCodes} from 'http-status-codes';
import {failureWithStatus} from '../../types/failure-with-status';
import {formatValidationErrors} from 'io-ts-reporters';
import {getAreaName} from './get-area-name';
import {membersTable} from '../../read-models/shared-state/state';
import {eq} from 'drizzle-orm';
import {SharedReadModel} from '../../read-models/shared-state';
import * as O from 'fp-ts/Option';

type ViewModel = {
  areaId: string;
  areaName: string;
  owner: {
    memberNumber: number;
    name: O.Option<string>;
    email: EmailAddress;
  };
};

const renderOwner = (owner: ViewModel['owner']) =>
  pipe(
    owner.name,
    O.match(
      () =>
        html`<a href="/member/${owner.memberNumber}"
          >${sanitizeString(owner.email)} (${owner.memberNumber})
        </a>`,
      name =>
        html`<a href="/member/${owner.memberNumber}"
          >${sanitizeString(name)} (${owner.memberNumber})</a
        >`
    )
  );

const renderForm = (viewModel: ViewModel) =>
  pipe(
    viewModel,
    () => html`
      <div class="stack-large">
        <h1>Remove owner?</h1>
        <div>
          <p>
            This will remove ${renderOwner(viewModel.owner)} from the owners of
            the <b>${sanitizeString(viewModel.areaName)}</b> area.
          </p>
          <p>
            They will also no longer be a trainer for any of the red equipment
            in the area.
          </p>
        </div>
        <form action="#" method="post">
          <input
            type="hidden"
            name="areaId"
            value="${safe(viewModel.areaId)}"
          />
          <input
            type="hidden"
            name="memberNumber"
            value="${viewModel.owner.memberNumber}"
          />
          <button type="submit">Confirm and send</button>
        </form>
      </div>
    `,
    toLoggedInContent(safe('Remove Owner'))
  );

const getOwner = (db: SharedReadModel['db'], memberNumber: number) =>
  pipe(
    db
      .select({
        name: membersTable.name,
        memberNumber: membersTable.memberNumber,
        email: membersTable.emailAddress,
      })
      .from(membersTable)
      .where(eq(membersTable.memberNumber, memberNumber))
      .get(),
    E.fromNullable(
      failureWithStatus(
        'The requested member does not exist',
        StatusCodes.NOT_FOUND
      )()
    )
  );

const paramsCodec = t.strict({
  memberNumber: tt.NumberFromString,
  areaId: tt.UUID,
});

const decodeParams = (input: unknown) =>
  pipe(
    input,
    paramsCodec.decode,
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

export const removeOwnerForm: Form<ViewModel> = {
  renderForm,
  constructForm:
    input =>
    ({readModel}) =>
      pipe(
        input,
        decodeParams,
        E.bind('areaName', ({areaId}) => getAreaName(readModel.db, areaId)),
        E.bind('owner', ({memberNumber}) =>
          getOwner(readModel.db, memberNumber)
        )
      ),
};
