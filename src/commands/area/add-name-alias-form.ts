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

// The area-level mapping page: pick which AREA a form label belongs to, for
// labels that name no single machine ("Wi-Fi / Computers / Printer").
// Reached from the equipment mapping page with ?alias=<raw form string>.
type ViewModel = {
  alias: string;
  areas: ReadonlyArray<{id: string; name: string}>;
};

const renderForm: Form<ViewModel>['renderForm'] = viewModel =>
  pipe(
    html`
      <div class="stack">
        <h1>Map a name to an area</h1>
        <p>
          Tickets whose form answer says
          <strong>${sanitizeString(viewModel.alias)}</strong> will be linked to
          the area you pick, now and for future submissions - without naming a
          specific machine. If the label is later mapped to a piece of
          equipment, the equipment wins.
        </p>
        <form action="/areas/add-name-alias" method="post" class="stack">
          <input
            type="hidden"
            name="alias"
            value="${sanitizeString(viewModel.alias)}"
          />
          <label class="stack">
            <strong>Area</strong>
            <select name="areaId" required>
              <option value="" disabled selected>Choose an area…</option>
              ${joinHtml(
                viewModel.areas.map(
                  area => html`
                    <option value="${safe(area.id)}">
                      ${sanitizeString(area.name)}
                    </option>
                  `
                )
              )}
            </select>
          </label>
          <div class="tt-actions">
            <button type="submit">Map to area</button>
            <a href="/trouble-tickets">Cancel</a>
          </div>
        </form>
      </div>
    `,
    toLoggedInContent(safe('Map a name to an area'))
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
      E.map(({alias}) => ({
        alias: alias.trim(),
        areas: [...readModel.area.getAllMinimal()]
          .map(area => ({id: area.id as string, name: area.name}))
          .sort((a, b) => a.name.localeCompare(b.name)),
      })),
      TE.fromEither
    );

export const addNameAliasForm: Form<ViewModel> = {
  renderForm,
  constructForm,
  formIsAuthorized: isAdminOrSuperUser,
};
