import * as O from 'fp-ts/Option';
import {DateTime} from 'luxon';
import {html, Html, safe} from '../../types/html';

// The one button that tells a machine's trainers you would like training,
// coming back to the machine's training page.
export const interestForm = (equipmentId: string, label: string): Html => html`
  <form
    class="training-interest__form"
    action="/training-sessions/express-interest?next=${safe(
      encodeURIComponent(`/equipment/${equipmentId}/training`)
    )}"
    method="post"
  >
    <input type="hidden" name="equipmentId" value="${safe(equipmentId)}" />
    <button type="submit" class="button-outline">
      ${safe(label)}
    </button>
  </form>
`;

const day = (date: Date) =>
  DateTime.fromJSDate(date)
    .setZone('Europe/London')
    .setLocale('en-GB')
    .toFormat('d LLLL yyyy');

// On a machine's training page, for somebody not trained on it yet: say you
// would like training, or, once you have, when you last did and a way to say
// it again so the trainers know the wish is still current.
export const renderInterest = (
  equipmentId: string,
  lastExpressed: O.Option<Date>
): Html =>
  O.isNone(lastExpressed)
    ? html`<div class="training-interest">
        <p>
          Nothing arranged that suits you? Let the trainers know you would like
          training on this machine: they see who is waiting, and for how long.
        </p>
        ${interestForm(equipmentId, 'Let the trainers know you would like training')}
      </div>`
    : html`<div class="training-interest">
        <p>
          You told the trainers you would like training on this machine on
          ${safe(day(lastExpressed.value))}.
        </p>
        ${interestForm(equipmentId, 'Tell them again')}
      </div>`;
