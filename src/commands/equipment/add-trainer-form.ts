import {pipe} from 'fp-ts/lib/function';
import * as t from 'io-ts';
import * as E from 'fp-ts/Either';
import {pageTemplate} from '../../templates';
import {html} from '../../types/html';
import * as O from 'fp-ts/Option';
import {DomainEvent, User} from '../../types';
import {v4} from 'uuid';
import {Form} from '../../types/form';
import {formatValidationErrors} from 'io-ts-reporters';
import {failureWithStatus} from '../../types/failureWithStatus';
import {StatusCodes} from 'http-status-codes';
import {readModels} from '../../read-models';

type ViewModel = {
  user: User;
  areaId: string;
  areaName: string;
};

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <h1>Add equipment to ${viewModel.areaName}</h1>
      <form action="/equipment/add" method="post">
        <label for="name">What is this Equipment called</label>
        <input type="text" name="name" id="name" />
        <input type="hidden" name="id" value="${v4()}" />
        <input type="hidden" name="areaId" value="${viewModel.areaId}" />
        <button type="submit">Confirm and send</button>
      </form>
    `,
    pageTemplate('Create Equipment', O.some(viewModel.user))
  );

const getAreaId = (input: unknown) =>
  pipe(
    input,
    t.strict({area: t.string}).decode,
    E.mapLeft(formatValidationErrors),
    E.mapLeft(failureWithStatus('Invalid parameters', StatusCodes.BAD_REQUEST)),
    E.map(({area}) => area)
  );

const getAreaName = (events: ReadonlyArray<DomainEvent>, areaId: string) =>
  pipe(
    areaId,
    readModels.areas.getArea(events),
    E.fromOption(() =>
      failureWithStatus('No such area', StatusCodes.NOT_FOUND)()
    ),
    E.map(area => area.name)
  );

const constructForm: Form<ViewModel>['constructForm'] =
  input =>
  ({user, events}) =>
    pipe(
      E.Do,
      E.bind('areaId', () => getAreaId(input)),
      E.bind('areaName', ({areaId}) => getAreaName(events, areaId)),
      E.bind('user', () => E.right(user))
    );

export const addTrainerForm: Form<ViewModel> = {
  renderForm,
  constructForm,
};
