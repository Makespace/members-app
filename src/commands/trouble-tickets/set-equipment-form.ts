import {pipe} from 'fp-ts/lib/function';
import * as t from 'io-ts';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {UUID} from 'io-ts-types';
import {formatValidationErrors} from 'io-ts-reporters';
import {StatusCodes} from 'http-status-codes';
import {
  html,
  joinHtml,
  safe,
  sanitizeString,
  toLoggedInContent,
} from '../../types/html';
import {Form} from '../../types/form';
import {failureWithStatus} from '../../types/failure-with-status';
import {SharedReadModel} from '../../read-models/shared-state';
import {User} from '../../types';

type AreaGroup = {
  areaName: string;
  equipment: ReadonlyArray<{id: UUID; name: string}>;
};

type ViewModel = {
  ticketId: UUID;
  title: string;
  currentEquipmentId: O.Option<UUID>;
  groups: ReadonlyArray<AreaGroup>;
};

// Equipment the viewer may assign a ticket to: everything for a super-user, otherwise the
// equipment in the areas they own (the command enforces the same rule).
const assignableGroups = (
  rm: SharedReadModel,
  user: User
): ReadonlyArray<AreaGroup> => {
  const viewer = rm.members.getByMemberNumber(user.memberNumber);
  const isSuperUser = O.isSome(viewer) && viewer.value.isSuperUser;
  const ownedAreaIds =
    O.isSome(viewer) ? viewer.value.ownerOf.map(area => area.id) : [];
  return rm.area
    .getAll()
    .filter(area => isSuperUser || ownedAreaIds.includes(area.id))
    .map(area => ({
      areaName: area.name,
      equipment: area.equipment.map(e => ({id: e.id, name: e.name})),
    }))
    .filter(group => group.equipment.length > 0);
};

const renderOption = (
  equipment: {id: UUID; name: string},
  currentEquipmentId: O.Option<UUID>
) => {
  const selected =
    O.isSome(currentEquipmentId) && currentEquipmentId.value === equipment.id
      ? safe(' selected')
      : safe('');
  return html`<option value="${safe(equipment.id)}"${selected}>
    ${sanitizeString(equipment.name)}
  </option>`;
};

const renderForm: Form<ViewModel>['renderForm'] = viewModel =>
  pipe(
    html`
      <div class="stack">
        <h1>Set equipment for this ticket</h1>
        <p>Ticket: <strong>${sanitizeString(viewModel.title)}</strong></p>
        <form
          action="/trouble-tickets/set-equipment"
          method="post"
          class="stack"
        >
          <input type="hidden" name="ticketId" value="${safe(viewModel.ticketId)}" />
          <label for="equipmentId">Equipment</label>
          <select name="equipmentId" id="equipmentId">
            <option value=""${O.isNone(viewModel.currentEquipmentId) ? safe(' selected') : safe('')}>
              Unassigned
            </option>
            ${joinHtml(
              viewModel.groups.map(
                group => html`<optgroup label="${sanitizeString(group.areaName)}">
                  ${joinHtml(
                    group.equipment.map(e =>
                      renderOption(e, viewModel.currentEquipmentId)
                    )
                  )}
                </optgroup>`
              )
            )}
          </select>
          <div class="tt-actions">
            <button type="submit">Set equipment</button>
            <a href="/trouble-tickets">Cancel</a>
          </div>
        </form>
      </div>
    `,
    toLoggedInContent(safe('Set equipment'))
  );

const constructForm: Form<ViewModel>['constructForm'] =
  input =>
  ({user, readModel}) =>
    pipe(
      input,
      t.type({ticketId: UUID}).decode,
      E.mapLeft(formatValidationErrors),
      E.mapLeft(
        failureWithStatus('Invalid parameters', StatusCodes.BAD_REQUEST)
      ),
      E.chain(({ticketId}) =>
        pipe(
          readModel.troubleTickets.getById(ticketId),
          E.fromOption(() =>
            failureWithStatus(
              'The requested trouble ticket does not exist',
              StatusCodes.NOT_FOUND
            )()
          ),
          E.map(ticket => ({
            ticketId,
            title: ticket.title,
            currentEquipmentId: O.fromNullable(ticket.equipmentId),
            groups: assignableGroups(readModel, user),
          }))
        )
      ),
      TE.fromEither
    );

export const setEquipmentForm: Form<ViewModel> = {
  renderForm,
  constructForm,
  formIsAuthorized: null,
};
