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
import {
  failureWithStatus,
} from '../../types/failure-with-status';
import {StatusCodes} from 'http-status-codes';

type ViewModel = {
  equipmentId: UUID;
  equipmentName: string;
  current: O.Option<string>;
};

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <h1>Equipment guide for ${sanitizeString(viewModel.equipmentName)}</h1>
      <p>
        The address of this machine's page on
        <a href="https://equipment.makespace.org">equipment.makespace.org</a>.
        It is printed on the machine's sign and linked from its training page,
        so paste the address from your browser rather than typing it from
        memory.
      </p>
      <form action="/equipment/set-guide-url" method="post" class="stack">
        <label for="guideUrl">Guide address</label>
        <input
          type="url"
          name="guideUrl"
          id="guideUrl"
          size="60"
          placeholder="https://equipment.makespace.org/wood-shop/band-saw"
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
    toLoggedInContent(safe('Equipment guide'))
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
        current: equipment.guideUrl,
      })),
      TE.fromEither
    );

export const setGuideUrlForm: Form<ViewModel> = {
  renderForm,
  constructForm,
  formIsAuthorized: null,
};
