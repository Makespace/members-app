/**
 * @jest-environment jsdom
 */

import * as TE from 'fp-ts/TaskEither';
import {deleteStoredEventForm} from '../../../src/commands/event-log/delete-stored-event-form';
import {UUID} from 'io-ts-types';
import {
  getLeftOrFail,
  getTaskEitherRightOrFail,
} from '../../helpers';
import {arbitraryUser} from '../../types/user.helper';
import {Dependencies} from '../../../src/dependencies';
import {FailureWithStatus} from '../../../src/types/failure-with-status';

const constructDeleteStoredEventForm = (
  input: unknown,
  deps: Partial<Dependencies>
): TE.TaskEither<FailureWithStatus, unknown> =>
  deleteStoredEventForm.constructForm(input)({
    user: arbitraryUser(),
    readModel: {} as never,
    deps: deps as unknown as Dependencies,
  }) as TE.TaskEither<FailureWithStatus, unknown>;

describe('delete stored event form', () => {
  it('displays the event details being deleted', () => {
    const rendered = deleteStoredEventForm.renderForm({
      eventId: 'cb5bdc6d-f734-43e2-a025-b5d89a5ba3fc' as UUID,
      eventType: 'AreaCreated',
      eventActor: 'System',
      eventRecordedAt: '1991-02-20T00:00:00.000Z',
      eventPayload: JSON.stringify({name: 'Craft room'}, null, 2),
    });

    const body = document.createElement('body');
    body.innerHTML = rendered.body;

    expect(body.textContent).toContain('cb5bdc6d-f734-43e2-a025-b5d89a5ba3fc');
    expect(body.textContent).toContain('AreaCreated');
    expect(body.textContent).toContain('System');
    expect(body.textContent).toContain('1991-02-20T00:00:00.000Z');
    expect(body.textContent).toContain('"name": "Craft room"');
    expect(
      body.querySelector('input[name="eventId"]')?.getAttribute('type')
    ).toBe('hidden');
  });

  it('constructs the form from only an event id parameter', async () => {
    const viewModel = await getTaskEitherRightOrFail(
      constructDeleteStoredEventForm(
        {
        eventId: 'cb5bdc6d-f734-43e2-a025-b5d89a5ba3fc',
        },
        {
          getAllEventsWithDeletionStatus: () =>
            TE.right([
              {
                event_index: 42,
                event_id: 'cb5bdc6d-f734-43e2-a025-b5d89a5ba3fc' as UUID,
                type: 'AreaCreated',
                actor: {tag: 'system'} as const,
                recordedAt: new Date('1991-02-20T00:00:00.000Z'),
                id: 'd1428735-0482-49c4-b16b-82503ccea74b' as UUID,
                name: 'Craft room',
                deletion: null,
              },
            ]),
        }
      )
    );

    expect(viewModel).toStrictEqual({
      eventId: 'cb5bdc6d-f734-43e2-a025-b5d89a5ba3fc',
      eventType: 'AreaCreated',
      eventActor: 'System',
      eventRecordedAt: '1991-02-20T00:00:00.000Z',
      eventPayload: JSON.stringify(
        {id: 'd1428735-0482-49c4-b16b-82503ccea74b', name: 'Craft room'},
        null,
        2
      ),
    });
  });

  it('looks up the stored event details using the event id', async () => {
    const viewModel = await getTaskEitherRightOrFail(
      constructDeleteStoredEventForm(
        {
        eventId: 'cb5bdc6d-f734-43e2-a025-b5d89a5ba3fc',
        },
        {
          getAllEventsWithDeletionStatus: () =>
            TE.right([
              {
                event_index: 42,
                event_id: 'cb5bdc6d-f734-43e2-a025-b5d89a5ba3fc' as UUID,
                type: 'AreaCreated',
                actor: {tag: 'system'} as const,
                recordedAt: new Date('1991-02-20T00:00:00.000Z'),
                id: 'd1428735-0482-49c4-b16b-82503ccea74b' as UUID,
                name: 'Craft room',
                deletion: null,
              },
            ]),
        }
      )
    );

    expect(viewModel).toStrictEqual({
      eventId: 'cb5bdc6d-f734-43e2-a025-b5d89a5ba3fc',
      eventType: 'AreaCreated',
      eventActor: 'System',
      eventRecordedAt: '1991-02-20T00:00:00.000Z',
      eventPayload: JSON.stringify(
        {id: 'd1428735-0482-49c4-b16b-82503ccea74b', name: 'Craft room'},
        null,
        2
      ),
    });
  });

  it('requires an event id parameter', async () => {
    const failure = getLeftOrFail(
      await constructDeleteStoredEventForm(
        {
          eventType: 'AreaCreated',
        },
        {}
      )()
    );

    expect(failure.status).toBe(400);
  });
});
