import {flow, pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import * as t from 'io-ts';
import {StatusCodes} from 'http-status-codes';
import {formatValidationErrors} from 'io-ts-reporters';
import {
  FailureWithStatus,
  failureWithStatus,
} from '../../types/failure-with-status';
import {Form} from '../../types/form';
import {
  html,
  safe,
  sanitizeString,
  toLoggedInContent,
} from '../../types/html';
import {SharedReadModel} from '../../read-models/shared-state';
import {
  areasTable,
} from '../../read-models/shared-state/state';
import {eq} from 'drizzle-orm';

type ViewModel = {
  areaId: string;
  areaName: string;
  currentEmail: string;
};

const renderBody = (viewModel: ViewModel) => html`
  <h1>Update mailing list for '${sanitizeString(viewModel.areaName)}'</h1>
  <form action="#" method="post">
    <label for="email">Mailing list email address</label>
    <input
      type="text"
      name="email"
      id="email"
      value="${safe(viewModel.currentEmail)}"
    />
    <input type="hidden" name="id" value="${safe(viewModel.areaId)}" />
    <button type="submit">Update mailing list</button>
  </form>
  <p>
    <small>Leave empty to remove the mailing list email</small>
  </p>
`;

const renderForm = (viewModel: ViewModel) =>
  pipe(viewModel, renderBody, toLoggedInContent(safe('Update area mailing list')));

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

const getAreaInfo = (db: SharedReadModel['db'], areaId: string) =>
  pipe(
    db
      .select({areaName: areasTable.name, email: areasTable.email})
      .from(areasTable)
      .where(eq(areasTable.id, areaId))
      .get(),
    E.fromNullable(
      failureWithStatus(
        'The requested area does not exist',
        StatusCodes.NOT_FOUND
      )()
    ),
    E.map(result => ({
      areaName: result.areaName,
      currentEmail: result.email ?? '',
    }))
  );

const constructForm: Form<ViewModel>['constructForm'] =
  input =>
  ({readModel}): E.Either<FailureWithStatus, ViewModel> =>
    pipe(
      E.Do,
      E.bind('areaId', () => getAreaId(input)),
      E.bind('areaInfo', ({areaId}) => getAreaInfo(readModel.db, areaId)),
      E.map(({areaId, areaInfo}) => ({
        areaId,
        areaName: areaInfo.areaName,
        currentEmail: areaInfo.currentEmail,
      }))
    );

export const setMailingListForm: Form<ViewModel> = {
  renderForm,
  constructForm,
};
