import {pipe} from 'fp-ts/lib/function';
import * as RA from 'fp-ts/ReadonlyArray';
import {html, safe, sanitizeString, joinHtml} from '../../types/html';
import {displayDate} from '../../templates/display-date';
import {DateTime} from 'luxon';
import {TrainedOn} from '../../read-models/shared-state/return-types';

const howToGetTrained = html`<details>
  <summary>How to get trained</summary>
  <div>
    <ol>
      <li>
        Do
        <a href="https://equipment.makespace.org/">the online training</a>
      </li>
      <li>
        Sign up for practical training session on
        <a href="https://www.meetup.com/makespace">Meetup</a>
      </li>
    </ol>
    <p>Remember:</p>
    <ul>
      <li>All trainers are members volunteering their time.</li>
      <li>
        Trainings are often only scheduled on demand after people have passed
        the online quiz.
      </li>
      <li>
        If you are struggling to join a practical training, reach out to the
        relevant owners via email.
      </li>
      <li>
        We always need more trainers. If you'd like to help others please let
        the owners know.
      </li>
    </ul>
  </div>
</details> `;

export const renderTrainingStatus = (
  trainedOn: ReadonlyArray<TrainedOn>,
  third_person: boolean
) =>
  pipe(
    trainedOn,
    RA.map(
      equipment =>
        html`<li>
          <a href="/equipment/${safe(equipment.id)}"
            >${sanitizeString(equipment.name)}</a
          >
          (since ${displayDate(DateTime.fromJSDate(equipment.trainedAt))})
        </li>`
    ),
    RA.match(
      () =>
        third_person
          ? html``
          : html`
              <p>You are currently not allowed to use any RED equipment.</p>
              ${howToGetTrained}
            `,
      listItems =>
        third_person
          ? html`
              <ul>
                ${joinHtml(listItems)}
              </ul>
            `
          : html`
              <p>You are permitted to use the following RED equipment:</p>
              <ul>
                ${joinHtml(listItems)}
              </ul>
              ${howToGetTrained}
            `
    )
  );
