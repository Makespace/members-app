import * as E from 'fp-ts/Either';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {html, safe, sanitizeString, toLoggedInContent} from '../../types/html';
import {Form} from '../../types/form';
import {failureWithStatus} from '../../types/failure-with-status';
import {getEquipmentIdFromForm} from '../equipment/get-equipment-id-from-form';
import {interestForm} from '../../queries/shared-render/training-interest';

type ViewModel = {equipment: {id: string; name: string}};

// Reached without the form on the machine's training page (a bookmark, a
// shared link): the same one button, with the machine named.
const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <div class="stack">
        <h1>
          Training on ${sanitizeString(viewModel.equipment.name)}
        </h1>
        <p>
          Tell the trainers you would like to be trained on this machine. They
          see who is waiting, and for how long, when they arrange sessions.
        </p>
        ${interestForm(viewModel.equipment.id, 'Let the trainers know')}
      </div>
    `,
    toLoggedInContent(safe('Training interest'))
  );

const constructForm: Form<ViewModel>['constructForm'] =
  input =>
  ({readModel}) =>
    pipe(
      getEquipmentIdFromForm(input),
      E.chain(equipmentId =>
        pipe(
          readModel.equipment.get(equipmentId),
          E.fromOption(() =>
            failureWithStatus('Unknown equipment', StatusCodes.NOT_FOUND)()
          )
        )
      ),
      E.map(equipment => ({
        equipment: {id: equipment.id, name: equipment.name},
      })),
      TE.fromEither
    );

export const expressInterestForm: Form<ViewModel> = {
  renderForm,
  constructForm,
  formIsAuthorized: null,
};
