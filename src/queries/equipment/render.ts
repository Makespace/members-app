import {pipe} from 'fp-ts/lib/function';
import {displayDate} from '../../templates/display-date';
import {
  html,
  safe,
  sanitizeString,
  toLoggedInContent,
} from '../../types/html';
import {ViewModel} from './view-model';
import * as O from 'fp-ts/Option';
import * as RA from 'fp-ts/ReadonlyArray';
import {DateTime} from 'luxon';
import {renderMembersAsList} from '../../templates/member-link-list';
import {currentTrainingSheetButton} from '../shared-render/current-training-sheet-button';


import {tooltip} from '../shared-render/tool-tip';
import { mailTo } from '../../templates/mailto';
import {
  categoryBadge,
  categoryDescription,
} from '../../templates/equipment-category';

const trainersList = (trainers: ViewModel['equipment']['trainers']) =>
  pipe(
    trainers,
    RA.match(
      () => html`<p>This equipment needs trainers.</p>`,
      renderMembersAsList
    )
  );

const isOwner = (viewModel: ViewModel) => viewModel.isSuperUserOrOwnerOfArea;

const isTrainer = (viewModel: ViewModel) =>
  viewModel.isSuperUserOrTrainerOfArea;

const isTrainerOrOwner = (viewModel: ViewModel) => isTrainer(viewModel) || viewModel.isSuperUserOrOwnerOfArea;

const trainMember = (viewModel: ViewModel) =>
  pipe(
    viewModel,
    O.of,
    O.filter(isTrainer),
    O.map(viewModel => viewModel.equipment.id),
    O.map(
      id =>
        html` <li>
          <a href="/equipment/mark-member-trained?equipmentId=${id}"
            >Mark member as trained</a
          >
        </li>`
    ),
    O.getOrElse(() => html``)
  );

const adminMarkTrainedBy = (viewModel: ViewModel) =>
  pipe(
    viewModel,
    O.of,
    O.filter(viewModel => viewModel.isSuperUser),
    O.map(viewModel => viewModel.equipment.id),
    O.map(
      id =>
        html` <li>
          <a href="/equipment/mark-member-trained-by?equipmentId=${id}"
            >[Admin] Mark member as trained by</a
          >
          ${tooltip(safe('Only admins can mark people as trained by others'))}
        </li>`
    ),
    O.getOrElse(() => html``)
  );

const addTrainer = (viewModel: ViewModel) =>
  pipe(
    viewModel,
    O.of,
    O.filter(isOwner),
    O.map(viewModel => viewModel.equipment.id),
    O.map(
      id =>
        html` <li>
          <a href="/equipment/add-trainer?equipment=${id}"> Add a trainer </a>
        </li>`
    ),
    O.getOrElse(() => html``)
  );

const removeTrainer = (viewModel: ViewModel) =>
  pipe(
    viewModel,
    O.of,
    O.filter(isOwner),
    O.filter(viewModel => viewModel.equipment.trainers.length > 0),
    O.map(viewModel => viewModel.equipment.id),
    O.map(
      id =>
        html` <li>
          <a href="/equipment/remove-trainer?equipment=${id}">
            Remove a trainer
          </a>
        </li>`
    ),
    O.getOrElse(() => html``)
  );

const registerSheet = (viewModel: ViewModel) =>
  pipe(
    viewModel,
    O.of,
    O.filter(isTrainerOrOwner),
    O.map(viewModel => viewModel.equipment.id),
    O.map(
      id =>
        html` <li>
          <a href="/equipment/add-training-sheet?equipmentId=${id}">
            Register training sheet
          </a>
        </li>`
    ),
    O.getOrElse(() => html``)
  );

const currentSheet = (viewModel: ViewModel) =>
  pipe(
    viewModel,
    O.of,
    O.filter(isTrainerOrOwner),
    O.flatMap(viewModel => viewModel.equipment.trainingSheetId),
    O.map(currentTrainingSheetButton),
    O.getOrElse(() => html``)
  );

const removeTrainingSheet = (viewModel: ViewModel) =>
  pipe(
    viewModel,
    O.of,
    O.filter(isTrainerOrOwner),
    O.flatMap(viewModel =>
      O.isNone(viewModel.equipment.trainingSheetId)
        ? O.none
        : O.some(viewModel.equipment.id)
    ),
    O.map(
      id =>
        html` <li>
          <a href="/equipment/remove-training-sheet?equipmentId=${id}">
            Remove training sheet
          </a>
        </li>`
    ),
    O.getOrElse(() => html``)
  );

const retireEquipment = (viewModel: ViewModel) =>
  pipe(
    viewModel,
    O.of,
    O.filter(viewModel => viewModel.isSuperUser),
    // Already-retired equipment has nothing to retire.
    O.filter(viewModel => O.isNone(viewModel.equipment.removedAt)),
    O.map(viewModel => viewModel.equipment.id),
    O.map(
      id =>
        html` <li>
          <a href="/equipment/mark-obsolete?equipmentId=${id}"
            >[Admin] Retire equipment</a
          >
          ${tooltip(
            html`Hide this equipment from members looking for training. Training records are kept.`
          )}
        </li>`
    ),
    O.getOrElse(() => html``)
  );

// Orange/green equipment has no training machinery, so only the
// admin-level actions apply.
const printSign = (viewModel: ViewModel) =>
  pipe(
    viewModel,
    O.of,
    O.filter(isOwner),
    O.map(vm => vm.equipment.id),
    O.map(
      id =>
        html` <li>
          <a href="/equipment-signs?equipmentId=${id}"
            >Print a sign for this equipment</a
          >
        </li>`
    ),
    O.getOrElse(() => html``)
  );

// The guide address is printed on this machine's sign and linked from its
// training page, so it is worth seeing at a glance whether one is recorded.
const guideLink = (viewModel: ViewModel) =>
  pipe(
    viewModel,
    O.of,
    O.filter(isTrainerOrOwner),
    O.map(
      vm => html` <li>
        <a href="/equipment/set-guide-url?equipmentId=${vm.equipment.id}"
          >${O.isSome(vm.equipment.guideUrl)
            ? safe('Change the equipment guide link')
            : safe('Add the equipment guide link')}</a
        >
        ${O.isSome(vm.equipment.guideUrl)
          ? html``
          : tooltip(
              html`Without it, this machine's sign prints without its "Learn"
              code and its training page has no guide to send members to.`
            )}
      </li>`
    ),
    O.getOrElse(() => html``)
  );

// A link nobody has checked is fine; a link that answered with a 404 this
// morning is a poster on a machine sending members nowhere, so it says so.
const guideLinkHealth = (viewModel: ViewModel) =>
  pipe(
    viewModel.guideLink,
    O.match(
      () => html``,
      check =>
        check.reachable
          ? html``
          : html`<br /><span class="guide-link-warning"
                >This link did not answer when it was last checked on
                ${displayDate(DateTime.fromJSDate(check.checkedAt))}${pipe(
                  check.status,
                  O.match(
                    () => html``,
                    status => html` (${safe(String(status))})`
                  )
                )}. The sign for this machine prints a code that leads
                there.</span
              >`
    )
  );

const guideForMembers = (viewModel: ViewModel) =>
  pipe(
    viewModel.equipment.guideUrl,
    O.match(
      () => html``,
      guideUrl =>
        html`<p>
          <strong>Equipment guide:</strong>
          <a href="${safe(guideUrl)}">${sanitizeString(guideUrl)}</a>
          ${guideLinkHealth(viewModel)}
        </p>`
    )
  );

// Super-users only: the colour decides whether a machine has training at all,
// so it is not a per-area decision.
const changeCategory = (viewModel: ViewModel) =>
  viewModel.isSuperUser
    ? html` <li>
        <a href="/equipment/set-category?equipmentId=${viewModel.equipment.id}"
          >Change the sticker category</a
        >
        ${tooltip(
          html`Red, orange or green. Training records are kept whichever way
          it goes.`
        )}
      </li>`
    : html``;

const reportProblem = (viewModel: ViewModel) =>
  html` <li>
    <a href="/trouble-tickets/raise?equipmentId=${viewModel.equipment.id}"
      >Report a problem with this equipment</a
    >
  </li>`;

// The board, already narrowed to this machine: somebody who came here about
// one machine wants that machine's tickets, not the whole backlog with it
// somewhere inside.
const viewTickets = (viewModel: ViewModel) =>
  viewModel.isSuperUserOrOwnerOfArea || viewModel.isSuperUser
    ? html` <li>
        <a
          href="/trouble-tickets/board?equipmentId=${viewModel.equipment.id}"
          >View trouble tickets for this equipment</a
        >
      </li>`
    : html``;

// Naming the units of a multi-machine entry (e.g. Printer 1, 2, 3).
const setMachines = (viewModel: ViewModel) =>
  pipe(
    viewModel,
    O.of,
    O.filter(isOwner),
    O.map(vm => vm.equipment.id),
    O.map(
      id =>
        html` <li>
          <a href="/equipment/set-machines?equipmentId=${id}"
            >Name the machines this entry stands for</a
          >
          ${tooltip(
            html`Use this when one entry covers several identical machines.
            Members reporting a problem are then asked which one.`
          )}
        </li>`
    ),
    O.getOrElse(() => html``)
  );

const equipmentActions = (viewModel: ViewModel) =>
  viewModel.equipment.category === 'red'
    ? html`
        <ul>
          ${reportProblem(viewModel)} ${viewTickets(viewModel)}
          ${printSign(viewModel)}
          ${setMachines(viewModel)} ${trainMember(viewModel)} ${adminMarkTrainedBy(viewModel)}
          ${addTrainer(viewModel)} ${removeTrainer(viewModel)}
          ${guideLink(viewModel)} ${changeCategory(viewModel)}
          ${registerSheet(viewModel)}
          ${currentSheet(viewModel)} ${removeTrainingSheet(viewModel)}
          ${retireEquipment(viewModel)}
        </ul>
      `
    : html`
        <ul>
          ${reportProblem(viewModel)} ${viewTickets(viewModel)}
          ${printSign(viewModel)}
          ${guideLink(viewModel)} ${changeCategory(viewModel)}
          ${setMachines(viewModel)} ${retireEquipment(viewModel)}
        </ul>
      `;

// The lists of people are long enough to bury everything above them, so each
// lives on a page of its own and is linked with its size: a trainer can see
// at a glance whether anybody is waiting before deciding to look.
const peopleLink = (
  viewModel: ViewModel,
  path: string,
  label: string,
  count: number
) => html`
  <li>
    <a href="/equipment/${safe(viewModel.equipment.id)}/${safe(path)}"
      >${safe(label)} (${safe(String(count))})</a
    >
  </li>
`;

const quizCounts = (viewModel: ViewModel) =>
  pipe(
    viewModel.quizResults,
    O.match(
      () => ({waiting: 0, failed: 0}),
      results => ({
        waiting:
          results.membersAwaitingTraining.length +
          results.unknownMembersAwaitingTraining.length,
        failed: results.failedQuizes.length,
      })
    )
  );

const peopleLinks = (viewModel: ViewModel) => {
  const counts = quizCounts(viewModel);
  return html`
    <ul>
      ${peopleLink(
        viewModel,
        'trained-users',
        'View currently trained users',
        viewModel.equipment.trainedMembers.length
      )}
      ${isTrainerOrOwner(viewModel)
        ? html`${peopleLink(
            viewModel,
            'quiz-results',
            'View training quiz results, and mark people as trained',
            counts.waiting
          )}
          ${peopleLink(
            viewModel,
            'failed-quizzes',
            'View failed quizzes',
            counts.failed
          )}`
        : html``}
    </ul>
  `;
};

export const render = (viewModel: ViewModel) =>
  pipe(
    viewModel,
    (viewModel: ViewModel) => html`
      <div class="stack">
        <h1>${sanitizeString(viewModel.equipment.name)}</h1>
        <p>
          ${categoryBadge(viewModel.equipment.category)} —
          ${categoryDescription(viewModel.equipment.category)}
        </p>
        <p>
          <strong>Area:</strong>
          <a href="/areas#area-${safe(viewModel.equipment.area.id)}">
            ${sanitizeString(viewModel.equipment.area.name)}
          </a>
          ${O.isSome(viewModel.equipment.area.email)
            ? html` | <strong>Mailing list:</strong>
              ${mailTo(viewModel.equipment.area.email.value, O.none, O.none)}`
            : html``}
        </p>
        ${guideForMembers(viewModel)} ${equipmentActions(viewModel)}
        ${viewModel.equipment.category === 'red'
          ? html`
              <h2>Trainers</h2>
              ${trainersList(viewModel.equipment.trainers)}
              <h2>Training</h2>
              ${peopleLinks(viewModel)}
            `
          : html``}
      </div>
    `,
    toLoggedInContent(sanitizeString(viewModel.equipment.name))
  );
