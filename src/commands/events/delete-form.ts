import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as TE from 'fp-ts/TaskEither';
import {flow, pipe} from 'fp-ts/lib/function';
import {formatValidationErrors} from 'io-ts-reporters';
import {inspect} from 'node:util';
import {DateTime} from 'luxon';
import {StatusCodes} from 'http-status-codes';
import {DeletedEvent, StoredDomainEvent} from '../../types';
import {mustBeSuperuser} from '../../queries/util';
import {displayDate} from '../../templates/display-date';
import {failureWithStatus} from '../../types/failure-with-status';
import {Form} from '../../types/form';
import {renderActor} from '../../types/actor';
import {
  html,
  joinHtml,
  safe,
  sanitizeString,
  toLoggedInContent,
} from '../../types/html';

type ViewModel = {
  event: StoredDomainEvent;
  deleted: DeletedEvent | null;
};

const paramsCodec = t.strict({
  eventId: tt.UUID,
});

const renderPayload = (event: StoredDomainEvent) =>
  pipe(
    event,
    ({
      type: _type,
      actor: _actor,
      recordedAt: _recordedAt,
      event_index: _eventIndex,
      event_id: _eventId,
      ...payload
    }) =>
      pipe(
        payload,
        Object.entries,
        entries =>
          entries.length === 0
            ? html`<p>No payload fields.</p>`
            : pipe(
                entries,
                entries =>
                  entries.map(
                    ([key, value]) => html`
                      <dt>${sanitizeString(key)}</dt>
                      <dd>${sanitizeString(inspect(value))}</dd>
                    `
                  ),
                joinHtml,
                items => html`<dl>${items}</dl>`
              )
      )
  );

const renderDeleted = (deleted: DeletedEvent) => html`
  <p>
    This event was deleted by ${renderActor(deleted.deletedBy)} at
    ${displayDate(DateTime.fromJSDate(deleted.deletedAt))}.
  </p>
  <p>Reason: ${sanitizeString(deleted.reason)}</p>
`;

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <h1>Delete event</h1>
      <p>Deleting an event removes it from future state calculations.</p>
      <dl>
        <dt>Type</dt>
        <dd>${sanitizeString(viewModel.event.type)}</dd>
        <dt>Actor</dt>
        <dd>${renderActor(viewModel.event.actor)}</dd>
        <dt>Recorded at</dt>
        <dd>${displayDate(DateTime.fromJSDate(viewModel.event.recordedAt))}</dd>
        <dt>Event index</dt>
        <dd>${sanitizeString(String(viewModel.event.event_index))}</dd>
        <dt>Event id</dt>
        <dd>${sanitizeString(viewModel.event.event_id)}</dd>
      </dl>
      <h2>Payload</h2>
      ${renderPayload(viewModel.event)}
      ${viewModel.deleted === null
        ? html`
            <form action="#" method="post">
              <input
                type="hidden"
                name="eventId"
                value="${viewModel.event.event_id}"
              />
              <label for="reason">Reason for deleting this event</label>
              <textarea id="reason" name="reason" required></textarea>
              <button type="submit">Delete event</button>
            </form>
          `
        : renderDeleted(viewModel.deleted)}
    `,
    toLoggedInContent(safe('Delete event'))
  );

const constructForm: Form<ViewModel>['constructForm'] =
  input =>
  ({deps, readModel, user}) =>
    pipe(
      mustBeSuperuser(readModel, user),
      TE.chain(() =>
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
          TE.fromEither
        )
      ),
      TE.bind('event', ({eventId}) =>
        pipe(
          deps.getEventById(eventId),
          TE.chain(
            TE.fromOption(() =>
              failureWithStatus('Event does not exist', StatusCodes.NOT_FOUND)()
            )
          )
        )
      ),
      TE.bind('deleted', ({event}) => deps.getDeletedEventById(event.event_id)),
      TE.map(({event, deleted}) => ({
        event,
        deleted: pipe(deleted, O.getOrElseW(() => null)),
      }))
    );

export const deleteEventForm: Form<ViewModel> = {
  renderForm,
  constructForm,
};
