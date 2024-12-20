import {pipe} from 'fp-ts/lib/function';
import * as t from 'io-ts';
import * as E from 'fp-ts/Either';
import {html, safe, sanitizeString, toLoggedInContent} from '../../types/html';
import {v4} from 'uuid';
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

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <h1>Add equipment to ${sanitizeString(viewModel.areaName)}</h1>
      <form action="/equipment/add" method="post">
        <label for="name">What is this Equipment called</label>
        <input type="text" name="name" id="name" />
        <input type="hidden" name="id" value="${v4() as UUID}" />
        <input type="hidden" name="areaId" value="${viewModel.areaId}" />
        <button type="submit">Confirm and send</button>
      </form>
    `,
    toLoggedInContent(safe('Create Equipment'))
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
      E.bind('areaName', ({areaId}) => getAreaName(readModel, areaId))
    );

export const addForm: Form<ViewModel> = {
  renderForm,
  constructForm,
};
