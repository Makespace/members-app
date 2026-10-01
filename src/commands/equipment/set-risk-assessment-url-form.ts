import {pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {
  html,
  safe,
  Safe,
  SanitizedString,
  sanitizeString,
  toLoggedInContent,
} from '../../types/html';
import {Form} from '../../types/form';
import {getEquipmentIdFromForm} from './get-equipment-id-from-form';
import {UUID} from 'io-ts-types';
import {failureWithStatus} from '../../types/failure-with-status';
import {StatusCodes} from 'http-status-codes';

type ViewModel = {
  equipmentId: UUID;
  equipmentName: string;
  current: O.Option<string>;
};

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <h1>
        Risk assessment for ${sanitizeString(viewModel.equipmentName)}
      </h1>
      <p>
        Where this machine's written risk assessment lives. It is shown on the
        machine's page so that anybody wondering what the hazards are can read
        it, so paste the address from your browser rather than typing it from
        memory.
      </p>
      <p>
        Whoever you link to needs to be readable by the people you expect to
        read it - a document nobody can open is worse than no link, because it
        looks like one.
      </p>
      <form
        action="/equipment/set-risk-assessment-url"
        method="post"
        class="stack"
      >
        <label for="riskAssessmentUrl">Risk assessment address</label>
        <input
          type="url"
          name="riskAssessmentUrl"
          id="riskAssessmentUrl"
          size="60"
          placeholder="https://drive.google.com/..."
          value="${pipe(
            viewModel.current,
            O.match(
              (): SanitizedString | Safe => safe(''),
              current => sanitizeString(current)
            )
          )}"
        />
        <input
          type="hidden"
          name="equipmentId"
          value="${viewModel.equipmentId}"
        />
        <button type="submit">Save</button>
      </form>
      <p>
        <small>Leave it empty to remove the link.</small>
      </p>
    `,
    toLoggedInContent(safe('Risk assessment'))
  );

const constructForm: Form<ViewModel>['constructForm'] =
  input =>
  ({readModel}) =>
    pipe(
      E.Do,
      E.bind('equipmentId', () => getEquipmentIdFromForm(input)),
      E.bind('equipment', ({equipmentId}) =>
        pipe(
          readModel.equipment.get(equipmentId),
          E.fromOption(
            failureWithStatus('Unknown equipment', StatusCodes.NOT_FOUND)
          )
        )
      ),
      E.map(({equipmentId, equipment}) => ({
        equipmentId,
        equipmentName: equipment.name,
        current: equipment.riskAssessmentUrl,
      })),
      TE.fromEither
    );

export const setRiskAssessmentUrlForm: Form<ViewModel> = {
  renderForm,
  constructForm,
  formIsAuthorized: null,
};
