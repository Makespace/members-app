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
import {Dependencies} from '../../dependencies';
import {EmailAddress} from '../../types';
import {Member, TrainedOn} from '../../read-models/shared-state/return-types';
import {
  getRecurlyReasonsForMember,
  RecurlyReason,
} from '../../read-models/external-state/recurly-status';
import {renderReasonChips} from '../../templates/recurly-reasons';
import {renderMemberNumber} from '../../templates/member-number';
import {displayDate} from '../../templates/display-date';
import {tag} from '../../templates/member-status';

// Rejoining is a two-step form. Step one asks for the two numbers (a GET back
// to this page); step two shows what the app and Recurly know about each record
// so the admin can decide whether the old training still counts, then POSTs.
// Recurly only tells us whether a subscription is live today, not when the old
// one ended, so the 6-month judgement stays with the admin.

type MemberSummary = {
  memberNumber: number;
  name: O.Option<string>;
  emails: ReadonlyArray<EmailAddress>;
  joined: Date;
  recurlyReasons: ReadonlyArray<RecurlyReason>;
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
    };

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
    Enter both numbers and you'll be shown what the app knows about each
    record before anything is changed.
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
    <li>Registered in the app: ${displayDate(summary.joined.getTime())}</li>
    <li>
      Recurly:
      ${summary.recurlyReasons.length === 0
        ? tag(html`Active subscription`, 'green')
        : renderReasonChips(summary.recurlyReasons)}
    </li>
    ${renderNames('Owner of', summary.ownerOf)}
    ${renderNames('Trainer for', summary.trainerFor)}
  </ul>
`;

const renderDecision = (
  oldMemberNumber: number,
  newMemberNumber: number
) => html`
  <h2>Should their old training still count?</h2>
  <p>
    Makespace policy is that training lapses if someone has not been a member
    for 6 months or more, and they must be trained again. Recurly can only tell
    us whether a subscription is live today, not when the old one ended, so use
    the dates above and what you know about the member to decide.
  </p>
  <form action="/members/rejoined-with-new" method="post">
    <input type="hidden" name="oldMemberNumber" value="${oldMemberNumber}" />
    <input type="hidden" name="newMemberNumber" value="${newMemberNumber}" />
    <fieldset>
      <legend>Training recorded on ${oldMemberNumber}:</legend>
      <div class="fieldset-item">
        <input
          type="radio"
          id="carry-over-training"
          name="carryOverTraining"
          value="true"
          required="true"
        />
        <label for="carry-over-training">
          <span
            >Keep it &mdash; they were away for less than 6 months</span
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
        />
        <label for="drop-training">
          <span
            >Remove it &mdash; they were away for 6 months or more and must
            be trained again</span
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
  ${viewModel.alreadyLinked
    ? html``
    : renderDecision(viewModel.oldMemberNumber, viewModel.newMemberNumber)}
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

const summarise =
  (deps: Pick<Dependencies, 'extDB'>) =>
  async (member: Member): Promise<MemberSummary> => {
    const {reasons} = await getRecurlyReasonsForMember(deps.extDB)(member);
    return {
      memberNumber: member.memberNumber,
      name: member.name,
      emails: member.emails.map(email => email.emailAddress),
      joined: member.joined,
      recurlyReasons: reasons,
      trainedOn: member.trainedOn,
      ownerOf: member.ownerOf.map(area => area.name),
      trainerFor: member.trainerFor.map(equipment => equipment.equipment_name),
    };
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

      return {
        step: 'confirm',
        oldMemberNumber,
        newMemberNumber,
        oldRecord: await summarise(deps)(oldMember.value),
        newRecord: O.isSome(newMember)
          ? O.some(await summarise(deps)(newMember.value))
          : O.none,
        alreadyLinked,
      };
    });

export const markMemberRejoinedWithNewNumberForm: Form<ViewModel> = {
  renderForm,
  constructForm,
  formIsAuthorized: null,
};
