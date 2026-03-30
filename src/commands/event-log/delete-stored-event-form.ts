import * as E from 'fp-ts/Either';
import * as TE from 'fp-ts/TaskEither';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import {pipe} from 'fp-ts/lib/function';
import {formatValidationErrors} from 'io-ts-reporters';
import {StatusCodes} from 'http-status-codes';
import {html, safe, sanitizeString, toLoggedInContent} from '../../types/html';
import {Form} from '../../types/form';
import {failureWithStatus} from '../../types/failure-with-status';
import {renderActor} from '../../types/actor';
import {StoredEventLogEntry} from '../../types/stored-event-log-entry';

type ViewModel = {
  eventId: tt.UUID;
  eventType?: string;
  eventActor?: string;
  eventRecordedAt?: string;
  eventPayload?: string;
};

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <h1>Delete Stored Event</h1>
      <dl>
        <dt>Event ID</dt>
        <dd>${sanitizeString(viewModel.eventId)}</dd>
        <dt>Type</dt>
        <dd>${sanitizeString(viewModel.eventType ?? '-')}</dd>
        <dt>Actor</dt>
        <dd>${sanitizeString(viewModel.eventActor ?? '-')}</dd>
        <dt>Recorded At</dt>
        <dd>${sanitizeString(viewModel.eventRecordedAt ?? '-')}</dd>
        <dt>Payload</dt>
        <dd>
          <pre>${sanitizeString(viewModel.eventPayload ?? '-')}</pre>
        </dd>
      </dl>
      <form action="#" method="post">
        <input
          type="hidden"
          name="eventId"
          value="${sanitizeString(viewModel.eventId)}"
        />
        <label for="reason">Delete reason</label>
        <input type="text" name="reason" id="reason" required />
        <button type="submit">Delete event</button>
      </form>
    `,
    toLoggedInContent(safe('Delete Stored Event'))
  );

const paramsCodec = t.strict({
  eventId: tt.UUID,
});

const decodeParams = E.mapLeft((errors: t.Errors) =>
  failureWithStatus(
    formatValidationErrors(errors).join(', '),
    StatusCodes.BAD_REQUEST
  )()
);

const formatPayload = (storedEvent: StoredEventLogEntry) =>
  JSON.stringify(
    (({
      type: _type,
      actor: _actor,
      recordedAt: _recordedAt,
      event_index: _eventIndex,
      event_id: _eventId,
      deletion: _deletion,
      ...payload
    }) => payload)(storedEvent),
    null,
    2
  );

const constructForm: Form<ViewModel>['constructForm'] =
  input =>
  ({deps}) =>
    pipe(
      input,
      paramsCodec.decode,
      decodeParams,
      TE.fromEither,
      TE.bindTo('params'),
      TE.bind('events', () => deps.getAllEventsWithDeletionStatus()),
      TE.chainEitherK(({params, events}) => {
        const storedEvent = events.find(
          candidate => candidate.event_id === params.eventId
        );

        return storedEvent === undefined
          ? E.left(
              failureWithStatus(
                'Stored event not found',
                StatusCodes.NOT_FOUND
              )()
            )
          : E.right({
              eventId: storedEvent.event_id,
              eventType: storedEvent.type,
              eventActor: String(renderActor(storedEvent.actor)),
              eventRecordedAt: storedEvent.recordedAt.toISOString(),
              eventPayload: formatPayload(storedEvent),
            });
      })
    );

export const deleteStoredEventForm: Form<ViewModel> = {
  renderForm,
  constructForm,
};
