import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import {flow, pipe} from 'fp-ts/lib/function';
import * as qs from 'qs';
import {StatusCodes} from 'http-status-codes';
import {formatValidationErrors} from 'io-ts-reporters';
import {Form} from '../../types/form';
import {
  html,
  safe,
  sanitizeString,
  toLoggedInContent,
} from '../../types/html';
import {failureWithStatus} from '../../types/failure-with-status';
import {path} from '../../types/path';
import { StoredDomainEvent } from '../../types';

type ViewModel = {
  eventIndex: number;
  eventType: string;
  eventId: string;
  payload: StoredDomainEvent;
  next: string;
};

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <div class="stack-large">
        <h1>Delete event ${viewModel.eventIndex}?</h1>
        <p>
          Note - Deleting events should be reserved for edge cases where an action needs to be 'undone' and cannot be reverted by using
          a regular command. For example if a user is marked as trained on a piece of equipment and it is decided to later revoke their
          training then you should use the regular 'revoke training' command and not delete it. The only case where deleting an event is
          appropriate is to undo an action that was just performed. - in other cases contact databaseowners@ first.
        </p>
        <p>
          <b>${sanitizeString(viewModel.eventType)}</b><br />
          Event ID: ${sanitizeString(viewModel.eventId)}
        </p>
        <form
          action="${safe(`?${qs.stringify({next: viewModel.next})}`)}"
          method="post"
        >
          <label for="delete-reason">Why are you deleting this event?</label>
          <textarea
            id="delete-reason"
            name="deleteReason"
            rows="4"
            required
          ></textarea>
          <input
            type="hidden"
            name="eventIndex"
            value="${safe(String(viewModel.eventIndex))}"
          />
          <button type="submit">Delete event</button>
        </form>
      </div>
    `,
    toLoggedInContent(safe('Delete Event'))
  );

const paramsCodec = t.intersection([
  t.strict({
    eventIndex: tt.IntFromString,
  }),
  t.partial({
    next: path,
  }),
]);

const constructForm: Form<ViewModel>['constructForm'] =
  input =>
  ({deps}) =>
    pipe(
      input,
      paramsCodec.decode,
      E.mapLeft(
        flow(
          formatValidationErrors,
          failureWithStatus(
            'Parameters submitted to the form were invalid',
            StatusCodes.BAD_REQUEST
          )
        )
      ),
      TE.fromEither,
      TE.chain(({eventIndex, next}) =>
        pipe(
          deps.getAllEvents(),
          TE.chain(events =>
            pipe(
              events.find(
                event =>
                  event.event_index === eventIndex && event.deletedAt === null
              ),
              O.fromNullable,
              TE.fromOption(() =>
                failureWithStatus(
                  'The requested event does not exist',
                  StatusCodes.NOT_FOUND
                )()
              )
            )
          ),
          TE.map(event => ({
            eventIndex,
            eventType: event.type,
            eventId: event.event_id,
            next: next ?? '/event-log',
          }))
        )
      )
    );

export const deleteEventForm: Form<ViewModel> = {
  renderForm,
  constructForm,
};
