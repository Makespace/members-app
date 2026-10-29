import {pipe} from 'fp-ts/lib/function';
import * as O from 'fp-ts/Option';
import {html, Html, joinHtml, safe, sanitizeString} from '../../types/html';
import {Focus, ViewModel} from './construct-view-model';
import {logInPath} from '../../authentication/login/routes';

const stat = (label: Html, count: number) => html`
  <li class="tt-home__stat">
    <strong class="tt-home__stat-count">${safe(String(count))}</strong>
    <span>${label}</span>
  </li>
`;

const summary = (viewModel: ViewModel) =>
  joinHtml([
    stat(
      pipe(
        viewModel.focus,
        O.match(
          () => html`open across Makespace`,
          focus =>
            focus.kind === 'equipment'
              ? html`open for this machine`
              : html`open in this area`
        )
      ),
      viewModel.active
    ),
    stat(html`reported by you`, viewModel.mine),
    pipe(
      viewModel.inMyAreas,
      O.match(
        () => html``,
        count => stat(html`in areas you own`, count)
      )
    ),
    pipe(
      viewModel.onMyMachines,
      O.match(
        () => html``,
        count => stat(html`on machines you train on`, count)
      )
    ),
  ]);

// With a focus, every heading and count on the page is about that machine or
// area - the page a QR code on the machine leads to.
const heading = (focus: O.Option<Focus>) =>
  pipe(
    focus,
    O.match(
      () => html`<h1>Trouble tickets</h1>`,
      focus => html`
        <h1>${sanitizeString(focus.name)}</h1>
        <p class="tt-home__where">
          Trouble tickets for
          ${focus.kind === 'equipment'
            ? html`this machine${pipe(
                focus.areaName,
                O.match(
                  () => html``,
                  area => html`, in ${sanitizeString(area)}`
                )
              )}`
            : html`this area`}.
          <a href="/trouble-tickets">See all of Makespace</a>.
        </p>
      `
    )
  );

const reportLink = (focus: O.Option<Focus>) =>
  pipe(
    focus,
    O.match(
      () => safe('/trouble-tickets/raise'),
      focus =>
        safe(
          focus.kind === 'equipment'
            ? `/trouble-tickets/raise?equipmentId=${encodeURIComponent(focus.id)}`
            : `/trouble-tickets/raise?areaId=${encodeURIComponent(focus.id)}`
        )
    )
  );

const reportHeading = (focus: O.Option<Focus>) =>
  pipe(
    focus,
    O.match(
      () => html`Report a problem`,
      focus =>
        focus.kind === 'equipment'
          ? html`Report a problem with ${sanitizeString(focus.name)}`
          : html`Report a problem in ${sanitizeString(focus.name)}`
    )
  );

export const render = (viewModel: ViewModel) => html`
  <div class="stack">
    ${heading(viewModel.focus)}
    <p>
      Trouble tickets tell the owners of a machine that something is wrong with
      it, so they can put it right.
    </p>

    <div class="tt-home">
      <section class="tt-home__card stack">
        <h2>${reportHeading(viewModel.focus)}</h2>
        <p>
          Something broken, unsafe, misconfigured, or out of consumables? Tell
          the people who look after it. You'll get an email confirming your
          report, and another when an owner picks it up.
        </p>
        <p>
          <a class="button" href="${reportLink(viewModel.focus)}"
            >Submit a trouble ticket</a
          >
        </p>
      </section>

      <section class="tt-home__card stack">
        <h2>
          ${pipe(
            viewModel.focus,
            O.match(
              () => html`Active trouble tickets`,
              focus => html`Open here: ${sanitizeString(focus.name)}`
            )
          )}
        </h2>
        <ul class="tt-home__stats">
          ${summary(viewModel)}
        </ul>
        ${viewModel.canSeeBoard
          ? html`<p>
              <a
                class="button"
                href="${safe(
                  pipe(
                    viewModel.focus,
                    O.match(
                      () => '/trouble-tickets/board',
                      focus =>
                        `/trouble-tickets/board?${
                          focus.kind === 'equipment' ? 'equipmentId' : 'areaId'
                        }=${focus.slug}`
                    )
                  )
                )}"
                >View active tickets</a
              >
            </p>`
          : html`<p class="tt-home__note">
              The full list is worked by the owners of each area. They'll be in
              touch about anything you've reported.
            </p>`}
      </section>

      <section class="tt-home__card stack">
        <h2>What you hear about</h2>
        <p>
          Which areas and machines you are told about, what has to happen to a
          ticket before you are told, and whether that reaches you as it
          happens or in a summary.
        </p>
        <p>
          <a class="button" href="/notification-settings"
            >Notification settings</a
          >
        </p>
      </section>
    </div>
  </div>
`;

// Logging in comes back here, to the same machine or area.
const homePath = (focus: O.Option<Focus>) =>
  pipe(
    focus,
    O.match(
      () => '/trouble-tickets',
      current =>
        `/trouble-tickets?${
          current.kind === 'equipment' ? 'equipmentId' : 'areaId'
        }=${encodeURIComponent(current.slug)}`
    )
  );

const logInTo = (path: string) =>
  safe(`${logInPath}?next=${encodeURIComponent(path)}`);

// For somebody not logged in - a QR code scanned on a phone that has never
// used the app. Reporting is open to anybody; seeing the tickets and choosing
// what you hear about are for members, so those ask them to log in.
export const renderPublic = (focus: O.Option<Focus>) => html`
  <div class="stack">
    ${heading(focus)}
    <p>
      Trouble tickets tell the owners of a machine that something is wrong with
      it, so they can put it right.
    </p>

    <div class="tt-home">
      <section class="tt-home__card stack">
        <h2>${reportHeading(focus)}</h2>
        <p>
          Something broken, unsafe, misconfigured, or out of consumables? Tell
          the people who look after it. You don't need to log in: give your
          email address and you'll get a confirmation.
        </p>
        <p>
          <a class="button" href="${reportLink(focus)}"
            >Submit a trouble ticket</a
          >
        </p>
      </section>

      <section class="tt-home__card stack">
        <h2>Active trouble tickets</h2>
        <p>
          Members can see what's open, and follow the problems they've
          reported.
        </p>
        <p>
          <a class="button" href="${logInTo(homePath(focus))}"
            >Log in to view active tickets</a
          >
        </p>
      </section>

      <section class="tt-home__card stack">
        <h2>What you hear about</h2>
        <p>
          Which areas and machines you are told about, and whether that reaches
          you as it happens or in a summary.
        </p>
        <p>
          <a class="button" href="${logInTo('/notification-settings')}"
            >Log in to change notification settings</a
          >
        </p>
      </section>
    </div>
  </div>
`;
