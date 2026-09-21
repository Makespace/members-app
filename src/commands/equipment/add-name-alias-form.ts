import {pipe} from 'fp-ts/lib/function';
import * as t from 'io-ts';
import * as E from 'fp-ts/Either';
import * as TE from 'fp-ts/TaskEither';
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
import {isAdminOrSuperUser} from '../authentication-helpers/is-admin-or-super-user';

// The mapping page: pick which equipment a form label (alias) belongs to.
// Reached from the trouble-ticket board's "unresolved equipment names"
// section with ?alias=<raw form string>.
type ViewModel = {
  alias: string;
  equipmentByArea: ReadonlyArray<{
    areaName: string;
    equipment: ReadonlyArray<{id: string; name: string}>;
  }>;
};

const renderForm: Form<ViewModel>['renderForm'] = viewModel =>
  pipe(
    html`
      <div class="stack">
        <h1>Map an equipment name</h1>
        <p>
          Tickets whose form answer says
          <strong>${sanitizeString(viewModel.alias)}</strong> will be linked to
          the equipment you pick, now and for future submissions. Tickets that
          were manually re-equipped are not changed.
        </p>
        <form action="/equipment/add-name-alias" method="post" class="stack">
          <input
            type="hidden"
            name="alias"
            value="${sanitizeString(viewModel.alias)}"
          />
          <label class="stack">
            <strong>Equipment</strong>
            <select name="equipmentId" required>
              <option value="" disabled selected>Choose equipment…</option>
              ${joinHtml(
                viewModel.equipmentByArea.map(
                  group => html`
                    <optgroup label="${sanitizeString(group.areaName)}">
                      ${joinHtml(
                        group.equipment.map(
                          equipment => html`
                            <option value="${safe(equipment.id)}">
                              ${sanitizeString(equipment.name)}
                            </option>
                          `
                        )
                      )}
                    </optgroup>
                  `
                )
              )}
            </select>
          </label>
          <div class="tt-actions">
            <button type="submit">Map name</button>
            <a href="/trouble-tickets">Cancel</a>
          </div>
        </form>
      </div>
    `,
    toLoggedInContent(safe('Map an equipment name'))
  );

const constructForm: Form<ViewModel>['constructForm'] =
  input =>
  ({readModel}) =>
    pipe(
      input,
      t.type({alias: t.string}).decode,
      E.mapLeft(formatValidationErrors),
      E.mapLeft(
        failureWithStatus('Missing alias parameter', StatusCodes.BAD_REQUEST)
      ),
      E.filterOrElse(
        ({alias}) => alias.trim() !== '',
        () =>
          failureWithStatus(
            'Missing alias parameter',
            StatusCodes.BAD_REQUEST
          )()
      ),
      E.map(({alias}) => {
        const byArea = new Map<string, {id: string; name: string}[]>();
        for (const area of readModel.area.getAll()) {
          for (const equipment of readModel.equipment.getForAreaMinimal(
            area.id
          )) {
            const bucket = byArea.get(area.name) ?? [];
            bucket.push({id: equipment.id, name: equipment.name});
            byArea.set(area.name, bucket);
          }
        }
        return {
          alias: alias.trim(),
          equipmentByArea: [...byArea.entries()]
            .map(([areaName, equipment]) => ({
              areaName,
              equipment: equipment.sort((a, b) =>
                a.name.localeCompare(b.name)
              ),
            }))
            .sort((a, b) => a.areaName.localeCompare(b.areaName)),
        };
      }),
      TE.fromEither
    );

export const addNameAliasForm: Form<ViewModel> = {
  renderForm,
  constructForm,
  formIsAuthorized: isAdminOrSuperUser,
};
