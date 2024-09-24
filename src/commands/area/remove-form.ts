import * as E from 'fp-ts/Either';
import * as t from 'io-ts';
import {pageTemplate} from '../../templates';
import {User} from '../../types';
import {Form} from '../../types/form';
import {flow, pipe} from 'fp-ts/lib/function';
import {html, safe, sanitizeString} from '../../types/html';
import {eq} from 'drizzle-orm';
import {StatusCodes} from 'http-status-codes';
import {SharedReadModel} from '../../read-models/shared-state';
import {areasTable} from '../../read-models/shared-state/state';
import {failureWithStatus} from '../../types/failure-with-status';
import {formatValidationErrors} from 'io-ts-reporters';

type ViewModel = {
  user: User;
  areaId: string;
  areaName: string;
};

const renderForm = (viewModel: ViewModel) =>
  pipe(
    viewModel,
    () => html`
      <div class="stack-large">
        <h1>Remove '${sanitizeString(viewModel.areaName)}'?</h1>
        <form action="#" method="post">
          <input type="hidden" name="id" value="${safe(viewModel.areaId)}" />
          <button type="submit">Confirm and send</button>
        </form>
      </div>
    `,
    pageTemplate(safe('Create Area'), viewModel.user)
  );

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

export const removeForm: Form<ViewModel> = {
  renderForm,
  constructForm:
    input =>
    ({user, readModel}) =>
      pipe(
        {user},
        E.right,
        E.bind('areaId', () => getAreaId(input)),
        E.bind('areaName', ({areaId}) => getAreaName(readModel.db, areaId))
      ),
};
