import {pipe} from 'fp-ts/lib/function';
import * as RA from 'fp-ts/ReadonlyArray';
import {html, sanitizeString, joinHtml} from '../../types/html';
import {displayDate} from '../../templates/display-date';
import {DateTime} from 'luxon';
import {TrainerFor} from '../../read-models/shared-state/return-types';

export const renderTrainerStatus = (trainerFor: ReadonlyArray<TrainerFor>) => {
  if (trainerFor.length === 0) {
    return '';
  }

  return pipe(
    trainerFor,
    RA.map(
      equipment =>
        html`<li>
          <a href="/equipment/${equipment.equipment_id}"
            >${sanitizeString(equipment.equipment_name)}</a
          >
          (trainer since ${displayDate(DateTime.fromJSDate(equipment.since))})
        </li>`
    ),
    listItems => html`
      <ul>
        ${joinHtml(listItems)}
      </ul>
    `
  );
};
