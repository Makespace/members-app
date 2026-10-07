import {pipe} from 'fp-ts/lib/function';
import {displayDate} from '../../templates/display-date';
import {
  Safe,
  html,
  Html,
  joinHtml,
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


import {tooltip, tooltipWith} from '../shared-render/tool-tip';
import {mailtoLink} from '../../templates/mailto';
import {
  categoryDot,
  categoryLabel,
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
          : tooltipWith(
              html`This link did not answer when it was last checked on
              ${displayDate(DateTime.fromJSDate(check.checkedAt))}${pipe(
                check.status,
                O.match(
                  () => html``,
                  status => html` (${safe(String(status))})`
                )
              )}. The sign for this machine prints a code that leads there.`,
              html`<i
                class="fa-solid fa-circle-exclamation guide-link-warning"
                aria-label="This link did not answer when it was last checked"
              ></i>`
            )
    )
  );

// Where an address points, in the words somebody would use for it. A risk
// assessment can be a hundred characters of Google Drive identifier, which
// says nothing and pushes everything beside it off the line.
const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

// A link as a capsule: what it is, where it goes, and nothing else. The whole
// address is on hover for anybody who wants to check it before clicking.
const linkCapsule = (input: {
  label: Html;
  href: string;
  hint: string;
  icon: Safe;
  dead?: boolean;
  after?: Html;
}) => html`
  <span class="eq-facts__fact">
    <a
      class="eq-capsule ${input.dead === true
        ? safe('eq-capsule--dead')
        : safe('')}"
      href="${safe(input.href)}"
      title="${sanitizeString(input.hint)}"
    >
      <i class="${input.icon}" aria-hidden="true"></i>
      <span class="eq-capsule__label">${input.label}</span>
      <span class="eq-capsule__where">${sanitizeString(hostOf(input.hint))}</span>
    </a>
    ${input.after ?? html``}
  </span>
`;

// A link that did not answer is shown in the colour of the problem, with the
// mark beside it rather than under the line: the address is the thing that
// needs fixing, so the address is what is marked.
const guideUnreachable = (viewModel: ViewModel) =>
  pipe(
    viewModel.guideLink,
    O.match(
      () => false,
      check => !check.reachable
    )
  );

const riskAssessmentFact = (viewModel: ViewModel) =>
  pipe(
    viewModel.equipment.riskAssessmentUrl,
    O.match(
      () => html``,
      riskAssessmentUrl =>
        linkCapsule({
          label: html`Risk assessment`,
          href: riskAssessmentUrl,
          hint: riskAssessmentUrl,
          icon: safe('fa-regular fa-file-lines'),
        })
    )
  );

const guideFact = (viewModel: ViewModel) =>
  pipe(
    viewModel.equipment.guideUrl,
    O.match(
      () => html``,
      guideUrl =>
        linkCapsule({
          label: html`Equipment guide`,
          href: guideUrl,
          hint: guideUrl,
          icon: safe('fa-regular fa-circle-question'),
          dead: guideUnreachable(viewModel),
          after: guideLinkHealth(viewModel),
        })
    )
  );

// Where the page sits: the areas list, then this machine's area. Replaces the
// browser-history "Back", which could not say where it was going.
const breadcrumb = (viewModel: ViewModel) => html`
  <nav class="eq-breadcrumb" aria-label="Breadcrumb">
    <a href="/areas">Areas</a> /
    <a href="/areas#area-${safe(viewModel.equipment.area.id)}"
      >${sanitizeString(viewModel.equipment.area.name)}</a
    >
  </nav>
  <style>
    .page-nav__back {
      display: none;
    }
  </style>
`;

// The machine's name, its colour beside it, and what that colour means -
// read as one thing rather than as a title with a footnote.
const equipmentHeading = (viewModel: ViewModel) => html`
  <div class="eq-heading">
    <h1>
      ${categoryDot(viewModel.equipment.category)}
      ${sanitizeString(viewModel.equipment.name)}
    </h1>
    <p class="eq-rule eq-rule--${safe(viewModel.equipment.category)}">
      <strong>${categoryLabel(viewModel.equipment.category)} equipment</strong>
      ${categoryDescription(viewModel.equipment.category)}
    </p>
  </div>
`;

// Owners of the area, or an admin. A risk assessment is the owning area's
// responsibility rather than a trainer's.
const setRiskAssessment = (viewModel: ViewModel) =>
  viewModel.isSuperUser || isOwner(viewModel)
    ? html` <li>
        <a
          href="/equipment/set-risk-assessment-url?equipmentId=${viewModel
            .equipment.id}"
          >${O.isSome(viewModel.equipment.riskAssessmentUrl)
            ? html`Change where the risk assessment lives`
            : html`Record where the risk assessment lives`}</a
        >
        ${tooltip(
          html`Shown on this page so anybody wondering what the hazards are
          can read it.`
        )}
      </li>`
    : html``;

// Admins and super-users. The old name keeps working as an alias, so this does
// not strand the tickets that used it.
const renameEquipment = (viewModel: ViewModel) =>
  viewModel.isSuperUser
    ? html` <li>
        <a href="/equipment/rename?equipmentId=${viewModel.equipment.id}"
          >Rename this machine</a
        >
        ${tooltip(
          html`The name it was called before keeps matching trouble tickets,
          and its training records are unaffected.`
        )}
      </li>`
    : html``;

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

// Each action already decides for itself whether the person looking may use
// it, and renders nothing when they may not. A heading with nothing under it
// is worse than no heading, so a group that comes back empty is left out
// entirely rather than announcing something that is not there.
const stat = (count: number, label: string) => html`
  <li class="tt-home__stat">
    <span class="tt-home__stat-count">${safe(String(count))}</span>
    <span>${safe(label)}</span>
  </li>
`;

// As `stat`, but the count links somewhere - used where the number answers
// "how many?" and the link answers "who?". Only offered where the viewer is
// allowed to open the target.
const statLink = (count: number, label: string, href: string) => html`
  <li class="tt-home__stat">
    <a href="${safe(href)}"
      ><span class="tt-home__stat-count">${safe(String(count))}</span></a
    >
    <span>${safe(label)}</span>
  </li>
`;

// Admin actions get the orange: the same colour the app uses to mean "this
// one is yours to do carefully", so a trainer's button and a member's button
// are not the same green.
const cardButton = (href: string, label: string, admin = false) => html`
  <a
    class="button${admin ? safe(' button--admin') : safe('')}"
    href="${safe(href)}"
    >${safe(label)}</a
  >
`;

// The two things people come to a machine's page to do. Everything else is a
// list below; these are the reasons the page gets opened.
const equipmentCards = (viewModel: ViewModel) => {
  const id = viewModel.equipment.id;
  return html`
    <div class="tt-home eq-cards">
      <section class="tt-home__card stack">
        <h2>Trouble tickets</h2>
        <ul class="tt-home__stats">
          ${stat(viewModel.tickets.active, 'active tickets')}
          ${stat(
            viewModel.tickets.resolvedRecently,
            'resolved in the last 30 days'
          )}
        </ul>
        <p class="eq-cards__actions">
          ${cardButton(
            `/trouble-tickets/raise?equipmentId=${id}`,
            'Open a ticket'
          )}
          ${viewModel.isSuperUserOrOwnerOfArea || viewModel.isSuperUser
            ? cardButton(
                `/trouble-tickets/board?equipmentId=${id}`,
                'View tickets'
              )
            : html``}
        </p>
      </section>
      ${viewModel.equipment.category === 'red'
        ? html`
            <section class="tt-home__card stack">
              <h2>Training</h2>
              <ul class="tt-home__stats">
                ${stat(viewModel.training.activeTrainers, 'active trainers')}
                ${stat(
                  viewModel.training.trainingsRecently,
                  'trainings in the last 30 days'
                )}
                ${isTrainerOrOwner(viewModel)
                  ? statLink(
                      viewModel.training.waitingForTraining,
                      'members waiting for training',
                      `/equipment/${id}/quiz-results`
                    )
                  : stat(
                      viewModel.training.waitingForTraining,
                      'members waiting for training'
                    )}
              </ul>
              <p class="eq-cards__actions">
                ${cardButton(`/equipment/${id}/training`, 'Get Trained')}
                ${isTrainerOrOwner(viewModel)
                  ? cardButton(
                      `/equipment/${id}/quiz-results`,
                      'Mark as Trained',
                      true
                    )
                  : html``}
              </p>
            </section>
          `
        : html``}
    </div>
  `;
};

const actionGroup = (title: string, items: ReadonlyArray<Html>): Html => {
  const visible = items.filter(item => item.trim() !== '');
  return visible.length === 0
    ? html``
    : html`
        <section class="equipment-actions">
          <h2>${safe(title)}</h2>
          <ul>
            ${joinHtml(visible)}
          </ul>
        </section>
      `;
};

const equipmentActions = (viewModel: ViewModel) => html`
  ${actionGroup(
    'Training',
    viewModel.equipment.category === 'red'
      ? [
          trainMember(viewModel),
          adminMarkTrainedBy(viewModel),
          addTrainer(viewModel),
          removeTrainer(viewModel),
          ...peopleLinks(viewModel),
        ]
      : []
  )}
  ${actionGroup('Update this equipment', [
    renameEquipment(viewModel),
    setMachines(viewModel),
    setRiskAssessment(viewModel),
    guideLink(viewModel),
    changeCategory(viewModel),
    printSign(viewModel),
    ...(viewModel.equipment.category === 'red'
      ? [
          registerSheet(viewModel),
          currentSheet(viewModel),
          removeTrainingSheet(viewModel),
        ]
      : []),
    retireEquipment(viewModel),
  ])}
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

const peopleLinks = (viewModel: ViewModel): ReadonlyArray<Html> => {
  const counts = quizCounts(viewModel);
  return [
    peopleLink(
      viewModel,
      'trained-users',
      'View currently trained users',
      viewModel.equipment.trainedMembers.length
    ),
    isTrainerOrOwner(viewModel)
      ? peopleLink(
          viewModel,
          'quiz-results',
          'View training quiz results, and mark people as trained',
          counts.waiting
        )
      : html``,
    isTrainerOrOwner(viewModel)
      ? peopleLink(viewModel, 'failed-quizzes', 'View failed quizzes', counts.failed)
      : html``,
  ];
};

export const render = (viewModel: ViewModel) =>
  pipe(
    viewModel,
    (viewModel: ViewModel) => html`
      <div class="stack">
        ${breadcrumb(viewModel)} ${equipmentHeading(viewModel)}
        <!-- A div rather than a p: the guide's warning mark is a tooltip,
             which is a div, and a browser closes a paragraph when one opens
             inside it - dropping the mark onto its own line. -->
        <!-- The area is in the breadcrumb above; saying it twice on one
             screen is saying it once too often. -->
        <div class="eq-facts">
          ${O.isSome(viewModel.equipment.area.email)
            ? html`<span class="eq-facts__fact">
                <a
                  class="eq-capsule"
                  href="${mailtoLink(
                    viewModel.equipment.area.email.value,
                    O.none,
                    O.none
                  )}"
                  title="${sanitizeString(viewModel.equipment.area.email.value)}"
                >
                  <i class="fa-regular fa-envelope" aria-hidden="true"></i>
                  <span class="eq-capsule__label">Mailing list</span>
                  <span class="eq-capsule__where"
                    >${sanitizeString(viewModel.equipment.area.email.value)}</span
                  >
                </a>
              </span>`
            : html``}
          ${guideFact(viewModel)} ${riskAssessmentFact(viewModel)}
        </div>
        ${equipmentCards(viewModel)} ${equipmentActions(viewModel)}
        ${viewModel.equipment.category === 'red'
          ? html`
              <h2>Trainers</h2>
              ${trainersList(viewModel.equipment.trainers)}
            `
          : html``}
      </div>
    `,
    toLoggedInContent(sanitizeString(viewModel.equipment.name))
  );
