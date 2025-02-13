import * as E from 'fp-ts/Either';
import * as t from 'io-ts';
import {Form} from '../../types/form';
import {flow, pipe} from 'fp-ts/lib/function';
import {html, safe, sanitizeString, toLoggedInContent} from '../../types/html';
import {StatusCodes} from 'http-status-codes';
import {failureWithStatus} from '../../types/failure-with-status';
import {formatValidationErrors} from 'io-ts-reporters';
import {getAreaName} from './get-area-name';

type ViewModel = {
  areaId: string;
  areaName: string;
};

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <div class="stack-large">
        <h1>Remove '${sanitizeString(viewModel.areaName)}'?</h1>
        <form action="#" method="post">
          <input type="hidden" name="id" value="${safe(viewModel.areaId)}" />
          <button type="submit">Confirm and send</button>
        </form>
      </div>
    `,
    toLoggedInContent(safe('Remove Area'))
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

export const removeAreaForm: Form<ViewModel> = {
  renderForm,
  constructForm:
    input =>
    ({readModel}) =>
      pipe(
        E.Do,
        E.bind('areaId', () => getAreaId(input)),
        E.bind('areaName', ({areaId}) => getAreaName(readModel.db, areaId))
      ),
};
