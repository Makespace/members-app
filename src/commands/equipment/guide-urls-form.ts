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

type ViewModel = {
  areaId: UUID;
  areaName: string;
  equipment: ReadonlyArray<{name: string; guideUrl: O.Option<string>}>;
};

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <div class="stack">
        <h1>Equipment guides for ${sanitizeString(viewModel.areaName)}</h1>
        <p>
          Paste the equipment site addresses, one per line. Each is matched to
          a machine by the last part of its address, so
          <code>.../wood-shop/band-saw</code> finds the Band Saw. Anything
          that matches nothing is reported back rather than guessed at.
        </p>
        <form action="/equipment/guide-urls" method="post" class="stack">
          <label class="stack">
            <strong>Addresses, one per line</strong>
            <textarea name="urls" rows="12" required></textarea>
          </label>
          <input
            type="hidden"
            name="areaId"
            value="${safe(viewModel.areaId)}"
          />
          <button type="submit">Match and save</button>
        </form>

        <h2>What this area has now</h2>
        <table>
          <thead>
            <tr>
              <th>Equipment</th>
              <th>Guide</th>
            </tr>
          </thead>
          <tbody>
            ${joinHtml(
              viewModel.equipment.map(
                item => html`<tr>
                  <td>${sanitizeString(item.name)}</td>
                  <td>
                    ${pipe(
                      item.guideUrl,
                      O.match(
                        () => html`<em>none</em>`,
                        url => html`${sanitizeString(url)}`
                      )
                    )}
                  </td>
                </tr>`
              )
            )}
          </tbody>
        </table>
      </div>
    `,
    toLoggedInContent(safe('Equipment guides'))
  );

const constructForm: Form<ViewModel>['constructForm'] =
  input =>
  ({readModel}: {readModel: SharedReadModel}) =>
    pipe(
      input,
      t.strict({area: UUID}).decode,
      E.mapLeft(formatValidationErrors),
      E.mapLeft(
        failureWithStatus('Invalid parameters', StatusCodes.BAD_REQUEST)
      ),
      E.chain(({area}) =>
        pipe(
          readModel.area.get(area),
          E.fromOption(() =>
            failureWithStatus('No such area', StatusCodes.NOT_FOUND)()
          ),
          E.map(found => ({
            areaId: area,
            areaName: found.name,
            equipment: readModel.equipment
              .getAllMinimal()
              .filter(
                item => item.areaId === area && O.isNone(item.removedAt)
              )
              .map(item => ({name: item.name, guideUrl: item.guideUrl}))
              .sort((a, b) => a.name.localeCompare(b.name)),
          }))
        )
      ),
      TE.fromEither
    );

export const guideUrlsForm: Form<ViewModel> = {
  renderForm,
  constructForm,
  formIsAuthorized: null,
};
