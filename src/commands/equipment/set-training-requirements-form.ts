import {pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {StatusCodes} from 'http-status-codes';
import {
  html,
  joinHtml,
  safe,
  sanitizeString,
  toLoggedInContent,
} from '../../types/html';
import {Form} from '../../types/form';
import {Equipment} from '../../read-models/shared-state/return-types';
import {failureWithStatus} from '../../types/failure-with-status';
import {getEquipmentIdFromForm} from './get-equipment-id-from-form';
import {isAdminSuperUserOrOwningTrainerForEquipment} from '../authentication-helpers/is-admin-or-super-user-or-owning-trainer';

type Choice = {id: string; name: string; chosen: boolean};

type ViewModel = {
  equipment: Equipment;
  quizRequired: boolean;
  // Every other machine with training, grouped by area, areas and machines
  // by name.
  areas: ReadonlyArray<{name: string; machines: ReadonlyArray<Choice>}>;
};

const choice = (machine: Choice) => html`
  <div class="training-requirement-choice">
    <input
      type="checkbox"
      name="prerequisites"
      id="prerequisite-${safe(machine.id)}"
      value="${safe(machine.id)}"
      ${machine.chosen ? html`checked` : html``}
    />
    <label for="prerequisite-${safe(machine.id)}"
      >${sanitizeString(machine.name)}</label
    >
  </div>
`;

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <h1>
        Training requirements for ${sanitizeString(viewModel.equipment.name)}
      </h1>
      <p>
        What a member needs before they come to an in-person training on this
        machine. Its training page walks them through it, and the Get trained
        page sends anybody not ready yet to that page instead of a session.
      </p>
      <form
        action="/equipment/set-training-requirements?next=${safe(
          encodeURIComponent(`/equipment/${viewModel.equipment.id}/training`)
        )}"
        method="post"
        class="stack"
      >
        <input
          type="hidden"
          name="equipmentId"
          value="${safe(viewModel.equipment.id)}"
        />
        <div class="training-requirement-choice">
          <input
            type="checkbox"
            name="quizRequired"
            id="quizRequired"
            value="yes"
            ${viewModel.quizRequired ? html`checked` : html``}
          />
          <label for="quizRequired"
            >Members must pass the online quiz first</label
          >
        </div>
        <fieldset class="stack">
          <legend>Machines they must already be trained on</legend>
          ${joinHtml(
            viewModel.areas.map(
              area => html`
                <div>
                  <h2 class="training-requirement-area">
                    ${sanitizeString(area.name)}
                  </h2>
                  ${joinHtml(area.machines.map(choice))}
                </div>
              `
            )
          )}
        </fieldset>
        <button type="submit">Save</button>
      </form>
    `,
    toLoggedInContent(safe('Training requirements'))
  );

const byName = <T extends {name: string}>(a: T, b: T) =>
  a.name.localeCompare(b.name);

const constructForm: Form<ViewModel>['constructForm'] =
  input =>
  ({readModel, user}) =>
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
      E.filterOrElse(
        equipment =>
          isAdminSuperUserOrOwningTrainerForEquipment({
            actor: {tag: 'user', user},
            rm: readModel,
            input: {equipmentId: equipment.id},
          }),
        () =>
          failureWithStatus(
            'Only owners who train on this equipment can set its training requirements',
            StatusCodes.FORBIDDEN
          )()
      ),
      E.map(equipment => {
        const requirements = readModel.trainingRequirements.get(equipment.id);
        const byArea = new Map<string, Choice[]>();
        for (const machine of readModel.equipment.getAll()) {
          if (
            machine.id === equipment.id ||
            machine.category !== 'red' ||
            O.isSome(machine.removedAt)
          ) {
            continue;
          }
          const machines = byArea.get(machine.area.name) ?? [];
          machines.push({
            id: machine.id,
            name: machine.name,
            chosen: requirements.prerequisiteEquipmentIds.includes(machine.id),
          });
          byArea.set(machine.area.name, machines);
        }
        return {
          equipment,
          quizRequired: requirements.quizRequired,
          areas: [...byArea.entries()]
            .map(([name, machines]) => ({
              name,
              machines: machines.sort(byName),
            }))
            .sort(byName),
        };
      }),
      TE.fromEither
    );

export const setTrainingRequirementsForm: Form<ViewModel> = {
  renderForm,
  constructForm,
  formIsAuthorized: null,
};
