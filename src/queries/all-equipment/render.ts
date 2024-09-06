import {pipe} from 'fp-ts/lib/function';
import {
  commaHtml,
  html,
  joinHtml,
  safe,
  sanitizeString,
} from '../../types/html';
import * as RA from 'fp-ts/ReadonlyArray';
import {ViewModel} from './view-model';
import {pageTemplate} from '../../templates';

const renderEquipment = (equipment: ViewModel['areas'][number]['equipment']) =>
  pipe(
    equipment,
    RA.map(
      item => html`
        <a href="/equipment/${safe(item.id)}">${sanitizeString(item.name)}</a>
      `
    ),
    commaHtml
  );

const renderArea = (area: ViewModel['areas'][number]) => html`
  <article>
    <h2>${sanitizeString(area.name)}</h2>
    <div>
      ${pipe(
        area.equipment,
        RA.match(
          () => html` <p>This area does not contain any RED equipment.</p> `,
          renderEquipment
        )
      )}
    </div>
  </article>
`;

const renderAreas = (areas: ViewModel['areas']) =>
  pipe(areas, RA.map(renderArea), joinHtml);

export const render = (viewModel: ViewModel) =>
  pipe(
    html`
      <div class="stack-large">
        <h1>Equipment of Makespace</h1>
        <div class="stack-large">${renderAreas(viewModel.areas)}</div>
      </div>
    `,
    pageTemplate(safe('Equipment'), viewModel.user)
  );
