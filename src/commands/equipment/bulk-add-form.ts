import {pipe} from 'fp-ts/lib/function';
import * as t from 'io-ts';
import * as E from 'fp-ts/Either';
import * as TE from 'fp-ts/TaskEither';
import {html, safe, sanitizeString, toLoggedInContent} from '../../types/html';
import {Form} from '../../types/form';
import {formatValidationErrors} from 'io-ts-reporters';
import {failureWithStatus} from '../../types/failure-with-status';
import {StatusCodes} from 'http-status-codes';
import {UUID} from 'io-ts-types';
import {SharedReadModel} from '../../read-models/shared-state';

type ViewModel = {
  areaId: UUID;
  areaName: string;
};

// Paste-a-list page for stocking an area with orange/green equipment (red is
// deliberately not offered here: red kit needs training set up, so it goes
// through the single add form).
const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <h1>Bulk-add equipment to ${sanitizeString(viewModel.areaName)}</h1>
      <form action="/equipment/bulk-add" method="post" class="stack">
        <fieldset class="stack">
          <legend><strong>Sticker category</strong></legend>
          <label class="checkbox-row">
            <input type="radio" name="category" value="orange" checked />
            <span>Orange</span>
          </label>
          <label class="checkbox-row">
            <input type="radio" name="category" value="green" />
            <span>Green</span>
          </label>
        </fieldset>
        <label class="stack">
          <strong>Equipment names, one per line</strong>
          <textarea name="names" rows="12" required></textarea>
        </label>
        <input type="hidden" name="areaId" value="${viewModel.areaId}" />
        <button type="submit">Add all</button>
      </form>
    `,
    toLoggedInContent(safe('Bulk-add equipment'))
  );

const getAreaId = (input: unknown) =>
  pipe(
    input,
    t.strict({area: UUID}).decode,
    E.mapLeft(formatValidationErrors),
    E.mapLeft(failureWithStatus('Invalid parameters', StatusCodes.BAD_REQUEST)),
    E.map(({area}) => area)
  );

const getAreaName = (readModel: SharedReadModel, areaId: UUID) =>
  pipe(
    areaId,
    readModel.area.get,
    E.fromOption(() =>
      failureWithStatus('No such area', StatusCodes.NOT_FOUND)()
    ),
    E.map(area => area.name)
  );

const constructForm: Form<ViewModel>['constructForm'] =
  input =>
  ({readModel}) =>
    pipe(
      E.Do,
      E.bind('areaId', () => getAreaId(input)),
      E.bind('areaName', ({areaId}) => getAreaName(readModel, areaId)),
      TE.fromEither
    );

export const bulkAddForm: Form<ViewModel> = {
  renderForm,
  constructForm,
  formIsAuthorized: null,
};
