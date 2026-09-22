import {pipe} from 'fp-ts/lib/function';
import * as O from 'fp-ts/Option';
import {html, Html, joinHtml, safe} from '../../types/html';
import {ViewModel} from './construct-view-model';

const stat = (label: Html, count: number) => html`
  <li class="tt-home__stat">
    <strong class="tt-home__stat-count">${safe(String(count))}</strong>
    <span>${label}</span>
  </li>
`;

const summary = (viewModel: ViewModel) =>
  joinHtml([
    stat(html`open across Makespace`, viewModel.active),
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

export const render = (viewModel: ViewModel) => html`
  <div class="stack">
    <h1>Trouble tickets</h1>
    <p>
      Trouble tickets tell the owners of a machine that something is wrong with
      it, so they can put it right.
    </p>

    <div class="tt-home">
      <section class="tt-home__card stack">
        <h2>Report a problem</h2>
        <p>
          Something broken, unsafe, misconfigured, or out of consumables? Tell
          the people who look after it. You'll get an email confirming your
          report, and another when an owner picks it up.
        </p>
        <p>
          <a class="button" href="/trouble-tickets/raise"
            >Submit a trouble ticket</a
          >
        </p>
      </section>

      <section class="tt-home__card stack">
        <h2>Active trouble tickets</h2>
        <ul class="tt-home__stats">
          ${summary(viewModel)}
        </ul>
        ${viewModel.canSeeBoard
          ? html`<p>
              <a class="button" href="/trouble-tickets/board"
                >View active tickets</a
              >
            </p>`
          : html`<p class="tt-home__note">
              The full list is worked by the owners of each area. They'll be in
              touch about anything you've reported.
            </p>`}
      </section>
    </div>
  </div>
`;
