import * as E from 'fp-ts/Either';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import {pipe} from 'fp-ts/lib/function';
import {formatValidationErrors} from 'io-ts-reporters';
import {StatusCodes} from 'http-status-codes';
import {html, safe, sanitizeString, toLoggedInContent} from '../../types/html';
import {Form} from '../../types/form';
import {failureWithStatus} from '../../types/failure-with-status';

class PathType extends t.Type<string> {
  readonly _tag = 'PathType' as const;

  constructor() {
    super(
      'string',
      (m): m is string => typeof m === 'string' && m.startsWith('/'),
      (m, c) => (this.is(m) ? t.success(m) : t.failure(m, c)),
      t.identity
    );
  }
}

const path = new PathType();

type ViewModel = {
  eventId?: tt.UUID;
  eventType?: string;
  eventActor?: string;
  eventRecordedAt?: string;
  eventPayload?: string;
  next?: string;
};

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <h1>Delete Stored Event</h1>
      ${viewModel.eventId === undefined
        ? html``
        : html`
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
          `}
      <form
        action="${viewModel.next === undefined
          ? safe('#')
          : safe(`?next=${encodeURIComponent(viewModel.next)}`)}"
        method="post"
      >
        <label for="eventId">Event ID</label>
        <input
          type="text"
          name="eventId"
          id="eventId"
          value="${viewModel.eventId === undefined
            ? safe('')
            : sanitizeString(viewModel.eventId)}"
        />
        <label for="reason">Delete reason</label>
        <input type="text" name="reason" id="reason" required />
        <button type="submit">Delete event</button>
      </form>
    `,
    toLoggedInContent(safe('Delete Stored Event'))
  );

const paramsCodec = t.partial({
  eventId: tt.UUID,
  eventType: t.string,
  eventActor: t.string,
  eventRecordedAt: t.string,
  eventPayload: t.string,
  next: path,
});

const constructForm: Form<ViewModel>['constructForm'] = input => () =>
  pipe(
    input,
    paramsCodec.decode,
    E.mapLeft(
      errors =>
        failureWithStatus(
          formatValidationErrors(errors).join(', '),
          StatusCodes.BAD_REQUEST
        )()
    ),
    E.map(({eventId, eventType, eventActor, eventRecordedAt, eventPayload, next}) => ({
      eventId,
      eventType,
      eventActor,
      eventRecordedAt,
      eventPayload,
      next,
    }))
  );

export const deleteStoredEventForm: Form<ViewModel> = {
  renderForm,
  constructForm,
};
