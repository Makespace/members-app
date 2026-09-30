import {pipe} from 'fp-ts/lib/function';
import * as t from 'io-ts';
import * as E from 'fp-ts/Either';
import * as TE from 'fp-ts/TaskEither';
import {UUID} from 'io-ts-types';
import {formatValidationErrors} from 'io-ts-reporters';
import {StatusCodes} from 'http-status-codes';
import {html, safe, sanitizeString, toLoggedInContent} from '../../types/html';
import {Form} from '../../types/form';
import {failureWithStatus} from '../../types/failure-with-status';

type ViewModel = {
  equipmentId: UUID;
  equipmentName: string;
};

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <div class="stack">
        <h1>Rename ${sanitizeString(viewModel.equipmentName)}</h1>
        <p>
          The old name keeps working: trouble tickets that name the machine the
          way it was called before are still matched to it, and so are any
          submitted while the form still offers the old label.
        </p>
        <p>
          Training records, quiz results and history all belong to the machine
          rather than to its name, so none of it is affected.
        </p>
        <form action="/equipment/rename" method="post" class="stack">
          <label for="name">Name</label>
          <input
            type="text"
            name="name"
            id="name"
            value="${sanitizeString(viewModel.equipmentName)}"
            required
          />
          <input
            type="hidden"
            name="equipmentId"
            value="${safe(viewModel.equipmentId)}"
          />
          <button type="submit">Save</button>
        </form>
      </div>
    `,
    toLoggedInContent(safe('Rename equipment'))
  );

const constructForm: Form<ViewModel>['constructForm'] =
  input =>
  ({readModel}) =>
    pipe(
      input,
      t.strict({equipmentId: UUID}).decode,
      E.mapLeft(formatValidationErrors),
      E.mapLeft(
        failureWithStatus('Invalid parameters', StatusCodes.BAD_REQUEST)
      ),
      E.chain(({equipmentId}) =>
        pipe(
          readModel.equipment.get(equipmentId),
          E.fromOption(
            failureWithStatus('Unknown equipment', StatusCodes.NOT_FOUND)
          ),
          E.map(equipment => ({
            equipmentId,
            equipmentName: equipment.name,
          }))
        )
      ),
      TE.fromEither
    );

export const renameForm: Form<ViewModel> = {
  renderForm,
  constructForm,
  formIsAuthorized: null,
};
