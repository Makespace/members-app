import * as E from 'fp-ts/Either';
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
  toLoggedInContent,
} from '../../types/html';
import {failureWithStatus} from '../../types/failure-with-status';
import {path} from '../../types/path';
import { DeletedStoredDomainEvent } from '../../types';
import { renderPayload } from '../../queries/shared-render/render-payload';
import { renderDeletedEvent } from '../../queries/shared-render/render-deleted-event';
import { isAdminOrSuperUser } from '../authentication-helpers/is-admin-or-super-user';

type ViewModel = {
  payload: DeletedStoredDomainEvent;
  next: string;
};

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <div class="stack-large">
        <h1>Un-delete event ${viewModel.payload.event_index}?</h1>
        ${renderDeletedEvent(viewModel.payload, {undeleteButton: false})}
        ${renderPayload(viewModel.payload)}
        <form
          action="${safe(`?${qs.stringify({next: viewModel.next})}`)}"
          method="post"
        >
          <input
            type="hidden"
            name="eventIndex"
            value="${safe(String(viewModel.payload.event_index))}"
          />
          <button type="submit">Un-delete event</button>
        </form>
      </div>
    `,
    toLoggedInContent(safe('Un-delete Event'))
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
          deps.getDeletedEventByIndex(eventIndex),
          TE.chain(
            TE.fromOption(
              () => failureWithStatus(
                'Event not found',
                StatusCodes.NOT_FOUND
              )({})
            )
          ),
          TE.map(event => ({
            eventIndex,
            eventType: event.type,
            eventId: event.event_id,
            next: next ?? '/event-log/deleted',
            payload: event,
          }))
        )
      )
    );

export const undeleteEventForm: Form<ViewModel> = {
  renderForm,
  constructForm,
  formIsAuthorized: isAdminOrSuperUser,
};
