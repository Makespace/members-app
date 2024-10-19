import {pipe} from 'fp-ts/lib/function';
import * as O from 'fp-ts/Option';
import {html, safe} from '../../types/html';
import {displayDate} from '../../templates/display-date';
import {DateTime} from 'luxon';

export const renderOwnerAgreementStatus = (
  status: O.Option<Date>,
  third_person: boolean
) =>
  pipe(
    status,
    O.matchW(
      () => safe(''),
      date =>
        third_person
          ? html`
              <p>
                User signed Owners Agreement
                (${displayDate(DateTime.fromJSDate(date))})
              </p>
            `
          : html`
              <p>
                You have signed the Owners Agreement
                (${displayDate(DateTime.fromJSDate(date))})
              </p>
            `
    )
  );
