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
  machineNames: ReadonlyArray<string>;
};

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <div class="stack">
        <h1>Machines under ${sanitizeString(viewModel.equipmentName)}</h1>
        <p>
          Some entries stand for several identical machines — three 3D
          printers, say. Name them one per line and members reporting a
          problem will be asked which one. Leave this empty if it is a single
          machine.
        </p>
        <form action="/equipment/set-machines" method="post" class="stack">
          <label class="stack">
            <strong>Machine names, one per line</strong>
            <textarea name="machineNames" rows="6">
${sanitizeString(viewModel.machineNames.join('\n'))}</textarea
            >
          </label>
          <input
            type="hidden"
            name="equipmentId"
            value="${safe(viewModel.equipmentId)}"
          />
          <button type="submit">Save</button>
        </form>
      </div>
    `,
    toLoggedInContent(safe('Machines'))
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
          E.fromOption(() =>
            failureWithStatus('No such equipment', StatusCodes.NOT_FOUND)()
          ),
          E.map(equipment => ({
            equipmentId,
            equipmentName: equipment.name,
            machineNames: equipment.machineNames,
          }))
        )
      ),
      TE.fromEither
    );

export const setMachinesForm: Form<ViewModel> = {
  renderForm,
  constructForm,
  formIsAuthorized: null,
};
