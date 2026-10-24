import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {Query} from '../query';
import {
  html,
  joinHtml,
  safe,
  sanitizeString,
  toLoggedInContent,
} from '../../types/html';
import {mustBeSuperuser} from '../util';
import {equipmentSlug} from '../../templates/slug';
import {Dependencies} from '../../dependencies';

type DisplayRow = {
  displayNumber: number;
  equipmentId: string;
  // None if the machine has since been deleted from the read model.
  equipment: O.Option<{name: string; areaName: string}>;
};

type ViewModel = {
  publicUrl: string;
  displays: ReadonlyArray<DisplayRow>;
};

const constructViewModel = (deps: Dependencies): ViewModel => ({
  publicUrl: deps.conf.PUBLIC_URL,
  displays: deps.sharedReadModel.einkDisplays.getAll().map(display => ({
    displayNumber: display.displayNumber,
    equipmentId: display.equipmentId,
    equipment: pipe(
      deps.sharedReadModel.equipment.get(display.equipmentId),
      O.map(equipment => ({
        name: equipment.name,
        areaName: equipment.area.name,
      }))
    ),
  })),
});

const shows = (row: DisplayRow) =>
  pipe(
    row.equipment,
    O.match(
      () => html`<em>A machine that no longer exists</em>`,
      equipment =>
        html`Trouble tickets for
          <a
            href="/equipment/${safe(
              equipmentSlug(equipment.areaName, equipment.name)
            )}"
            >${sanitizeString(equipment.name)}</a
          >
          (${sanitizeString(equipment.areaName)})`
    )
  );

const renderRow = (row: DisplayRow) => {
  const n = safe(row.displayNumber.toString());
  return html`
    <tr>
      <td>${n}</td>
      <td>${shows(row)}</td>
      <td><a href="/e-ink/assign?displayNumber=${n}">Change</a></td>
      <td>
        <form action="/e-ink/unassign" method="post">
          <input type="hidden" name="displayNumber" value="${n}" />
          <button type="submit">Clear</button>
        </form>
      </td>
    </tr>
  `;
};

const render = (viewModel: ViewModel) => html`
  <div class="stack">
    <h1>E-ink displays</h1>
    <p>
      Each display is flashed once with its own number's address,
      <code>${sanitizeString(viewModel.publicUrl)}/e-ink/<em>n</em>.png</code>,
      and the display token. What it shows is chosen here, so moving a display
      to another machine needs no reflash. A number not listed here shows "not
      set up". See <code>docs/eink-displays.md</code> for what a display can
      rely on.
    </p>
    <p><a href="/e-ink/assign">Set up a display</a></p>
    ${viewModel.displays.length === 0
      ? html`<p>No displays are set up yet.</p>`
      : html`
          <table>
            <thead>
              <tr>
                <th>Display</th>
                <th>Shows</th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${joinHtml(viewModel.displays.map(renderRow))}
            </tbody>
          </table>
        `}
  </div>
`;

export const einkDisplays: Query = deps => user =>
  pipe(
    mustBeSuperuser(deps.sharedReadModel, user),
    TE.map(() => constructViewModel(deps)),
    TE.map(render),
    TE.map(toLoggedInContent(safe('E-ink displays')))
  );
