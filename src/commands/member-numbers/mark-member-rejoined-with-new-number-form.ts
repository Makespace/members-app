import {pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as RA from 'fp-ts/ReadonlyArray';
import * as TE from 'fp-ts/TaskEither';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import {
  commaHtml,
  Html,
  html,
  joinHtml,
  safe,
  sanitizeOption,
  sanitizeString,
  toLoggedInContent,
} from '../../types/html';
import {Form} from '../../types/form';
import {EmailAddress} from '../../types';
import {Member, TrainedOn} from '../../read-models/shared-state/return-types';
import {
  getSubscriptionHistoryForEmails,
  MembershipGap,
  membershipGap,
  SubscriptionSummary,
  TRAINING_LAPSES_AFTER,
} from '../../read-models/external-state/membership-gap';
import {renderMemberNumber} from '../../templates/member-number';
import {displayDate, displayDateOnly} from '../../templates/display-date';
import {tag} from '../../templates/member-status';

// Rejoining is a two-step form. Step one asks for the two numbers (a GET back
// to this page); step two shows what the app and Recurly know about the member
// so the admin can decide whether the old training still counts, then POSTs.
//
// The decision turns on how long they were away. Recurly's subscription
// history gives the end of the old membership and the start of the new one,
// so where both are known the page works the gap out and pre-selects the
// answer; the admin still confirms it.

type MemberSummary = {
  memberNumber: number;
  name: O.Option<string>;
  emails: ReadonlyArray<EmailAddress>;
  trainedOn: ReadonlyArray<TrainedOn>;
  ownerOf: ReadonlyArray<string>;
  trainerFor: ReadonlyArray<string>;
};

type ViewModel =
  | {step: 'pick-numbers'; error: O.Option<string>}
  | {
      step: 'confirm';
      oldMemberNumber: number;
      newMemberNumber: number;
      oldRecord: MemberSummary;
      // The new number may not have been registered in the app yet.
      newRecord: O.Option<MemberSummary>;
      alreadyLinked: boolean;
      // Everything Recurly holds against either record's addresses.
      subscriptions: ReadonlyArray<SubscriptionSummary>;
      gap: MembershipGap;
      // What the gap implies, when it is known well enough to say.
      suggestedCarryOver: O.Option<boolean>;
    };

const lapseMonths = TRAINING_LAPSES_AFTER.as('months');

const renderPickNumbers = (error: O.Option<string>) => html`
  <h1>Mark member rejoined with new number</h1>
  ${pipe(
    error,
    O.match(
      () => html``,
      message => html`<p>${tag(html`${sanitizeString(message)}`, 'red')}</p>`
    )
  )}
  <p>
    Enter both numbers and you'll be shown what the app and Recurly know
    about the member before anything is changed.
  </p>
  <form action="/members/rejoined-with-new" method="get">
    <label for="oldMemberNumber"
      >What was the member's old membership number?</label
    >
    <input
      type="number"
      name="oldMemberNumber"
      id="oldMemberNumber"
      required="true"
    />
    <label for="newMemberNumber"
      >What is the member's new membership number?
    </label>
    <input
      type="number"
      name="newMemberNumber"
      id="newMemberNumber"
      required="true"
    />
    <button type="submit">Next</button>
  </form>
`;

const renderTraining = (trainedOn: ReadonlyArray<TrainedOn>) =>
  pipe(
    trainedOn,
    RA.match(
      () => html`<p>No training recorded on this number.</p>`,
      rows => html`
        <table>
          <thead>
            <tr>
              <th>Equipment</th>
              <th>Trained on</th>
            </tr>
          </thead>
          <tbody>
            ${pipe(
              rows,
              RA.map(
                row => html`<tr>
                  <td>${sanitizeString(row.name)}</td>
                  <td>${displayDate(row.trainedAt.getTime())}</td>
                </tr>`
              ),
              joinHtml
            )}
          </tbody>
        </table>
      `
    )
  );

const renderNames = (label: string, names: ReadonlyArray<string>) =>
  pipe(
    names,
    RA.match(
      () => html``,
      names => html`<li>
        ${safe(label)}:
        ${pipe(names, RA.map(sanitizeString), commaHtml)}
      </li>`
    )
  );

const renderSummary = (summary: MemberSummary): Html => html`
  <ul>
    <li>Name: ${sanitizeOption(summary.name)}</li>
    <li>
      Emails:
      ${pipe(
        summary.emails,
        RA.map(email => sanitizeString(email)),
        commaHtml
      )}
    </li>
    ${renderNames('Owner of', summary.ownerOf)}
    ${renderNames('Trainer for', summary.trainerFor)}
  </ul>
`;

const optionalDate = (date: Date | null) =>
  date === null ? safe('-') : displayDateOnly(date);

const renderSubscriptions = (subscriptions: ReadonlyArray<SubscriptionSummary>) =>
  pipe(
    subscriptions,
    RA.match(
      () => html`<p>
        Recurly has no subscriptions under any of these email addresses. If
        the old membership was paid for under a different address, add it to
        the member's record and come back to this page.
      </p>`,
      rows => html`
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Plan</th>
              <th>State</th>
              <th>Started</th>
              <th>Ended</th>
            </tr>
          </thead>
          <tbody>
            ${pipe(
              rows,
              RA.map(
                row => html`<tr>
                  <td>${sanitizeString(row.email)}</td>
                  <td>${sanitizeString(row.planCode ?? '-')}</td>
                  <td>${sanitizeString(row.state)}</td>
                  <td>${optionalDate(row.startedAt)}</td>
                  <td>${optionalDate(row.endedAt)}</td>
                </tr>`
              ),
              joinHtml
            )}
          </tbody>
        </table>
      `
    )
  );

const monthsAway = (months: number) =>
  months === 1 ? html`1 month` : html`${months} months`;

// Chips are short by design (see .tag); the sentence after carries the dates.
const lapsedTag = (lapsed: boolean) =>
  lapsed
    ? tag(html`Training has lapsed`, 'red')
    : tag(html`Training still counts`, 'green');

const renderGap = (gap: MembershipGap): Html => {
  switch (gap.tag) {
    case 'known':
      return html`
        <p>${lapsedTag(gap.lapsed)}</p>
        <p>
          Previous membership ended <b>${displayDateOnly(gap.previousEndedAt)}</b>.
          Current membership started <b>${displayDateOnly(gap.currentStartedAt)}</b>.
          That is <b>${monthsAway(gap.monthsAway)}</b> away, which is
          ${gap.lapsed ? html`${lapseMonths} months or more` : html`less than ${lapseMonths} months`}.
        </p>
      `;
    case 'no-current':
      return html`
        <p>
          ${gap.lapsed ? lapsedTag(true) : tag(html`Not settled yet`, 'yellow')}
        </p>
        <p>
          Previous membership ended <b>${displayDateOnly(gap.previousEndedAt)}</b>,
          <b>${monthsAway(gap.monthsAway)}</b> ago. Recurly shows nothing live for
          the member yet, so that is the gap so far${gap.lapsed
            ? html` - already ${lapseMonths} months or more.`
            : html`. Check how they are paying now before deciding.`}
        </p>
      `;
    case 'no-previous':
      return html`
        <p>${tag(html`Gap unknown`, 'yellow')}</p>
        <p>
          A live membership started <b>${displayDateOnly(gap.currentStartedAt)}</b>,
          but Recurly shows nothing before it that ended. Either they never
          actually left, or the old membership was under an email address the
          app doesn't have.
        </p>
      `;
    case 'no-data':
      return html`<p>${tag(html`Gap unknown`, 'yellow')}</p>`;
  }
};

const checkedIf = (condition: boolean) => (condition ? safe('checked') : safe(''));

const renderDecision = (
  viewModel: Extract<ViewModel, {step: 'confirm'}>
) => html`
  <h2>Should their old training still count?</h2>
  <p>
    Makespace policy is that training lapses if someone has not been a member
    for ${lapseMonths} months or more, and they must be trained again.
    ${O.isSome(viewModel.suggestedCarryOver)
      ? html`The answer below is filled in from the Recurly dates above - check
        it before confirming.`
      : html`Recurly can't settle it here, so use the table above and what you
        know about the member.`}
  </p>
  <form action="/members/rejoined-with-new" method="post">
    <input type="hidden" name="oldMemberNumber" value="${viewModel.oldMemberNumber}" />
    <input type="hidden" name="newMemberNumber" value="${viewModel.newMemberNumber}" />
    <fieldset>
      <legend>Training recorded on ${viewModel.oldMemberNumber}:</legend>
      <div class="fieldset-item">
        <input
          type="radio"
          id="carry-over-training"
          name="carryOverTraining"
          value="true"
          required="true"
          ${checkedIf(O.getOrElse(() => false)(viewModel.suggestedCarryOver))}
        />
        <label for="carry-over-training">
          <span
            >Keep it &mdash; they were away for less than ${lapseMonths}
            months</span
          >
        </label>
      </div>
      <div class="fieldset-item">
        <input
          type="radio"
          id="drop-training"
          name="carryOverTraining"
          value="false"
          required="true"
          ${checkedIf(
            pipe(
              viewModel.suggestedCarryOver,
              O.exists(carryOver => !carryOver)
            )
          )}
        />
        <label for="drop-training">
          <span
            >Remove it &mdash; they were away for ${lapseMonths} months or more
            and must be trained again</span
          >
        </label>
      </div>
    </fieldset>
    <p>
      Super-user status is always removed on rejoining. Owner and trainer
      roles are kept either way.
    </p>
    <button type="submit">Confirm and link the numbers</button>
  </form>
`;

const renderConfirm = (
  viewModel: Extract<ViewModel, {step: 'confirm'}>
) => html`
  <h1>Mark member rejoined with new number</h1>
  ${viewModel.alreadyLinked
    ? html`<p>
        ${tag(html`Already linked`, 'green')} ${renderMemberNumber(
          viewModel.oldMemberNumber
        )}
        and ${renderMemberNumber(viewModel.newMemberNumber)} already belong to
        the same member. There is nothing to do.
      </p>`
    : html``}
  <h2>Old record ${renderMemberNumber(viewModel.oldMemberNumber)}</h2>
  ${renderSummary(viewModel.oldRecord)}
  <h3>Training</h3>
  ${renderTraining(viewModel.oldRecord.trainedOn)}
  <h2>New record ${renderMemberNumber(viewModel.newMemberNumber)}</h2>
  ${pipe(
    viewModel.newRecord,
    O.match(
      () => html`<p>
        Not registered in the app yet. The new number will be added to the old
        record, so the member can log in with their existing email.
      </p>`,
      renderSummary
    )
  )}
  <h2>How long were they away?</h2>
  ${renderGap(viewModel.gap)}
  ${renderSubscriptions(viewModel.subscriptions)}
  ${viewModel.alreadyLinked ? html`` : renderDecision(viewModel)}
`;

const renderForm = (viewModel: ViewModel) =>
  pipe(
    viewModel.step === 'pick-numbers'
      ? renderPickNumbers(viewModel.error)
      : renderConfirm(viewModel),
    toLoggedInContent(safe('Mark a member as rejoining makespace'))
  );

const paramsCodec = t.partial({
  oldMemberNumber: tt.IntFromString,
  newMemberNumber: tt.IntFromString,
});

const pickNumbers = (error: O.Option<string>): ViewModel => ({
  step: 'pick-numbers',
  error,
});

const summarise = (member: Member): MemberSummary => ({
  memberNumber: member.memberNumber,
  name: member.name,
  emails: member.emails.map(email => email.emailAddress),
  trainedOn: member.trainedOn,
  ownerOf: member.ownerOf.map(area => area.name),
  trainerFor: member.trainerFor.map(equipment => equipment.equipment_name),
});

// Only a gap that Recurly actually pins down (or one already past the
// threshold however it ends) is turned into a pre-selected answer.
const suggestCarryOver = (gap: MembershipGap): O.Option<boolean> => {
  switch (gap.tag) {
    case 'known':
      return O.some(!gap.lapsed);
    case 'no-current':
      return gap.lapsed ? O.some(false) : O.none;
    case 'no-previous':
    case 'no-data':
      return O.none;
  }
};

const constructForm: Form<ViewModel>['constructForm'] =
  input =>
  ({deps, readModel}) =>
    TE.fromTask(async () => {
      const params = pipe(
        paramsCodec.decode(input),
        E.getOrElseW(() => ({}) as t.TypeOf<typeof paramsCodec>)
      );
      if (
        params.oldMemberNumber === undefined ||
        params.newMemberNumber === undefined
      ) {
        return pickNumbers(O.none);
      }
      const {oldMemberNumber, newMemberNumber} = params;
      if (oldMemberNumber >= newMemberNumber) {
        return pickNumbers(
          O.some('The old number must be lower than the new number')
        );
      }
      const oldMember = readModel.members.getByMemberNumber(oldMemberNumber);
      if (O.isNone(oldMember)) {
        return pickNumbers(
          O.some(`No member with number ${oldMemberNumber} is known to the app`)
        );
      }
      const newMember = readModel.members.getByMemberNumber(newMemberNumber);
      const alreadyLinked =
        O.isSome(newMember) && newMember.value.userId === oldMember.value.userId;

      const oldRecord = summarise(oldMember.value);
      const newRecord = pipe(newMember, O.map(summarise));
      const subscriptions = await getSubscriptionHistoryForEmails(deps.extDB)([
        ...oldRecord.emails,
        ...pipe(
          newRecord,
          O.map(record => record.emails),
          O.getOrElseW(() => [])
        ),
      ]);
      const gap = membershipGap(subscriptions, new Date());

      return {
        step: 'confirm',
        oldMemberNumber,
        newMemberNumber,
        oldRecord,
        newRecord,
        alreadyLinked,
        subscriptions,
        gap,
        suggestedCarryOver: suggestCarryOver(gap),
      };
    });

export const markMemberRejoinedWithNewNumberForm: Form<ViewModel> = {
  renderForm,
  constructForm,
  formIsAuthorized: null,
};
