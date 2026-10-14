import {html, Html, safe, sanitizeString} from '../../types/html';
import {equipmentCategoriesPath} from '../../commands/area/set-equipment-categories-form';
import {ViewModel} from './view-model';

const action = (href: string, label: string, description: Html) => html`
  <div class="manage-area__action">
    <a class="button" href="${safe(href)}">${safe(label)}</a>
    <p>${description}</p>
  </div>
`;

const categoriesSummary = (viewModel: ViewModel) =>
  viewModel.categoryCount === 0
    ? html`Group a long equipment list into sections on the Areas page. This
      area doesn't use categories yet.`
    : html`${safe(viewModel.categoryCount.toString())}
      ${safe(viewModel.categoryCount === 1 ? 'category' : 'categories')};
      ${safe(viewModel.uncategorisedCount.toString())} of
      ${safe(viewModel.equipmentCount.toString())} items not in one yet.`;

export const render = (viewModel: ViewModel) => {
  const area = safe(viewModel.areaId);
  return html`
    <div class="stack-large">
      <h1>Manage ${sanitizeString(viewModel.areaName)}</h1>
      <section class="stack">
        <h2>Equipment</h2>
        ${viewModel.isSuperUser
          ? action(
              `/equipment/add?area=${area}`,
              'Add equipment',
              html`One item of any colour. Red equipment needs training set
                up, so only admins add it.`
            )
          : html``}
        ${action(
          `/equipment/bulk-add?area=${area}`,
          'Bulk-add orange/green',
          html`Paste a list of names, one per line.`
        )}
        ${action(
          equipmentCategoriesPath(viewModel.areaId),
          'Equipment categories',
          categoriesSummary(viewModel)
        )}
      </section>
      ${viewModel.isSuperUser
        ? html`
            <section class="stack">
              <h2>Owners</h2>
              ${action(
                `/areas/add-owner?area=${area}`,
                'Add owner',
                html`Owners look after the area and train on its red
                  equipment.`
              )}
            </section>
            <section class="stack">
              <h2>Area</h2>
              ${action(
                `/areas/set-mailing-list?area=${area}`,
                'Set mailing list',
                html`The address shown for contacting the area's owners.`
              )}
              ${action(
                `/areas/remove?area=${area}`,
                'Remove area',
                html`Asks for confirmation first.`
              )}
            </section>
          `
        : html``}
    </div>
  `;
};
