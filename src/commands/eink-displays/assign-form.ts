import * as t from 'io-ts';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {UUID} from 'io-ts-types';
import {html, safe, toLoggedInContentWithBackLink} from '../../types/html';
import {Form} from '../../types/form';
import {
  EquipmentPickerModel,
  equipmentPickerChoices,
  staticEquipmentPicker,
} from '../../templates/equipment-picker';
import {isAdminOrSuperUser} from '../authentication-helpers/is-admin-or-super-user';
import {
  MAX_DISPLAY_NUMBER,
  parseDisplayNumber,
} from '../../eink/display-number';
import {SharedReadModel} from '../../read-models/shared-state';

type ViewModel = EquipmentPickerModel & {
  displayNumber: number;
};

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <div class="stack">
        <h1>Choose what an e-ink display shows</h1>
        <form action="/e-ink/assign" method="post" class="stack">
          <label for="displayNumber">Display number</label>
          <input
            type="number"
            name="displayNumber"
            id="displayNumber"
            min="1"
            max="${safe(MAX_DISPLAY_NUMBER.toString())}"
            required
            value="${safe(viewModel.displayNumber.toString())}"
          />
          <p>It shows the open trouble tickets of:</p>
          ${staticEquipmentPicker(viewModel)}
          <button type="submit">Save</button>
        </form>
      </div>
    `,
    toLoggedInContentWithBackLink(safe('E-ink display'), {
      href: '/e-ink',
      label: 'E-ink displays',
    })
  );

// The lowest number no display has yet, for setting up a new one.
const firstFreeNumber = (readModel: SharedReadModel) => {
  const taken = new Set(
    readModel.einkDisplays.getAll().map(display => display.displayNumber)
  );
  let n = 1;
  while (taken.has(n)) {
    n++;
  }
  return n;
};

// ?displayNumber= changes an existing display, starting from what it shows
// now; without it, a new display gets the first free number.
const constructForm: Form<ViewModel>['constructForm'] =
  input =>
  ({readModel}) => {
    const query = pipe(
      input,
      t.partial({displayNumber: t.unknown, equipmentId: UUID}).decode,
      E.getOrElseW(() => ({displayNumber: undefined, equipmentId: undefined}))
    );
    const displayNumber =
      parseDisplayNumber(query.displayNumber) ?? firstFreeNumber(readModel);
    return TE.right({
      ...equipmentPickerChoices(readModel),
      displayNumber,
      selectedEquipmentId: pipe(
        O.fromNullable<string | undefined>(query.equipmentId),
        O.alt<string>(() => readModel.einkDisplays.get(displayNumber))
      ),
    });
  };

export const assignForm: Form<ViewModel> = {
  renderForm,
  constructForm,
  formIsAuthorized: isAdminOrSuperUser,
};
