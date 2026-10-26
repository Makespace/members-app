import * as t from 'io-ts';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {html, safe, sanitizeString, toLoggedInContent} from '../../types/html';
import {Form} from '../../types/form';
import {failureWithStatus} from '../../types/failure-with-status';
import {renderMemberNumber} from '../../templates/member-number';
import {displayDate} from '../../templates/display-date';
import {DateTime} from 'luxon';
import {ClaimState, claimStateFor, ticketFromClaimToken} from './claim';

type ViewModel = {
  token: string;
  ticketId: string;
  state: ClaimState;
  memberNumber: number;
  equipment: string;
  reportedAt: Date;
  issue: string;
  // The address they reported from, when their account does not have it yet.
  emailToAdd: O.Option<string>;
};

const ticketPath = (viewModel: ViewModel) =>
  `/trouble-tickets/view/${viewModel.ticketId}`;

const summary = (viewModel: ViewModel) => html`
  <dl class="tt-claim__summary">
    <dt>Equipment</dt>
    <dd>${sanitizeString(viewModel.equipment)}</dd>
    <dt>Reported</dt>
    <dd>${displayDate(DateTime.fromJSDate(viewModel.reportedAt))}</dd>
    <dt>Issue</dt>
    <dd>${sanitizeString(viewModel.issue)}</dd>
  </dl>
`;

// Offered once the ticket is theirs: the address they reported from is the
// one we will recognise next time.
const addEmail = (viewModel: ViewModel) =>
  pipe(
    viewModel.emailToAdd,
    O.match(
      () => html``,
      email => html`
        <div class="stack tt-claim__email">
          <p>
            You reported this from
            <strong>${sanitizeString(email)}</strong>, which isn't on your
            account. Add it, and next time we'll recognise you straight away.
          </p>
          <form
            action="/members/add-email?next=${safe(ticketPath(viewModel))}"
            method="post"
          >
            <input type="hidden" name="email" value="${sanitizeString(email)}" />
            <input
              type="hidden"
              name="memberNumber"
              value="${safe(viewModel.memberNumber.toString())}"
            />
            <button type="submit">Add this address to my account</button>
          </form>
        </div>
      `
    )
  );

const renderForm = (viewModel: ViewModel) => {
  switch (viewModel.state) {
    case 'claimable':
      return pipe(
        html`
          <div class="stack">
            <h1>Add this report to your account</h1>
            ${summary(viewModel)}
            <p>
              It will be listed as reported by you, member
              ${renderMemberNumber(viewModel.memberNumber)}, and you'll hear
              about updates as your
              <a href="/notification-settings">notification settings</a> say.
            </p>
            <form
              action="?next=${safe(ticketPath(viewModel))}"
              method="post"
            >
              <input
                type="hidden"
                name="token"
                value="${sanitizeString(viewModel.token)}"
              />
              <button type="submit">Add it to my account</button>
            </form>
            ${addEmail(viewModel)}
          </div>
        `,
        toLoggedInContent(safe('Add this report to your account'))
      );
    case 'yours':
      return pipe(
        html`
          <div class="stack">
            <h1>This report is on your account</h1>
            ${summary(viewModel)}
            <p><a href="${safe(ticketPath(viewModel))}">View the ticket</a></p>
            ${addEmail(viewModel)}
          </div>
        `,
        toLoggedInContent(safe('This report is on your account'))
      );
    case 'someone-else':
      return pipe(
        html`
          <div class="stack">
            <h1>This report is on another account</h1>
            <p>
              Somebody else has already added this report to their account.
              If you think that's wrong, email
              <a href="mailto:owners@makespace.org">owners@makespace.org</a>.
            </p>
          </div>
        `,
        toLoggedInContent(safe('This report is on another account'))
      );
  }
};

const constructForm: Form<ViewModel>['constructForm'] =
  input =>
  ({user, deps, readModel}) =>
    pipe(
      input,
      t.strict({token: t.string}).decode,
      E.mapLeft(() =>
        failureWithStatus(
          'This link is incomplete. Please use the link from your confirmation email.',
          StatusCodes.BAD_REQUEST
        )()
      ),
      E.chain(({token}) =>
        pipe(
          ticketFromClaimToken(readModel, deps.conf.TOKEN_SECRET, token),
          E.map(ticket => ({token, ticket}))
        )
      ),
      E.map(({token, ticket}) => {
        const member = readModel.members.getByMemberNumber(user.memberNumber);
        const onAccount = pipe(
          member,
          O.map(found =>
            found.emails.map(email => email.emailAddress.toLowerCase())
          ),
          O.getOrElse((): ReadonlyArray<string> => [])
        );
        const equipment = pipe(
          O.fromNullable(ticket.equipmentId),
          O.chain(id => readModel.equipment.get(id)),
          O.map(found => found.name),
          O.getOrElse(
            () =>
              ticket.response.otherEquipmentDetail ||
              ticket.submittedEquipment ||
              'Not listed'
          )
        );
        const state = claimStateFor(readModel, ticket, user.memberNumber);
        return {
          token,
          ticketId: ticket.id,
          state,
          memberNumber: user.memberNumber,
          equipment,
          reportedAt: ticket.submittedAt,
          issue: ticket.response.issue,
          emailToAdd:
            state === 'someone-else'
              ? O.none
              : pipe(
                  O.fromNullable(ticket.submittedEmail),
                  O.filter(
                    email => !onAccount.includes(email.toLowerCase())
                  )
                ),
        };
      }),
      TE.fromEither
    );

export const claimForm: Form<ViewModel> = {
  renderForm,
  constructForm,
  formIsAuthorized: null,
};
