import {flow, pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import * as TE from 'fp-ts/TaskEither';
import {html, safe, toLoggedInContent} from '../../types/html';
import {Form} from '../../types/form';
import {StoredDomainEvent} from '../../types';
import { renderEvent } from '../../queries/shared-render/render-domain-event';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import { formatValidationErrors } from 'io-ts-reporters';
import { failureWithStatus } from '../../types/failure-with-status';
import { StatusCodes } from 'http-status-codes';
import * as O from 'fp-ts/Option';

type ViewModel = {
  event: O.Option<StoredDomainEvent>,
};

const renderForm = (viewModel: ViewModel) =>
  O.isSome(viewModel.event) ?
  pipe(
    html`
      <h1>Exclude an event</h1>
      <p>Are you sure you want to exclude (delete) this event? This form should only be used in limited circumstances.</p>
      <p>NOTE THIS WILL NOT TAKE EFFECT UNTIL THE APP IS RESTARTED</p>
      ${renderEvent(viewModel.event.value)}
      <form action="?next=/event-log" method="post">
        <input type="hidden" name="event_id" value="${viewModel.event.value.event_id}"/>
        <label for="reason">Whats the reason for deleting this event?</label>
        <input type="text" name="reason" id="reason" value="" minlength="3" required/>
        <button type="submit">Confirm</button>
      </form>
    `,
    toLoggedInContent(safe('Exclude event'))
  ) : pipe(
    html`
      <h1>Unknown event</h1>
    `,
    toLoggedInContent(safe('Exclude event'))
  );

const paramsCodec = t.strict({
  event_id: tt.UUID
});

const constructForm: Form<ViewModel>['constructForm'] = input => ({deps}) => pipe(
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
  E.map(params => params.event_id),
  TE.fromEither,
  TE.chain(deps.getEventById),
  TE.map(
    event => ({
      event,
    })
  ),
);

export const excludeEventForm: Form<ViewModel> = {
  renderForm,
  constructForm,
};
