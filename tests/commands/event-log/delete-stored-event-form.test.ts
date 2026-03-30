/**
 * @jest-environment jsdom
 */

import {deleteStoredEventForm} from '../../../src/commands/event-log/delete-stored-event-form';
import {NonEmptyString, UUID} from 'io-ts-types';

describe('delete stored event form', () => {
  it('displays the event being deleted', () => {
    const rendered = deleteStoredEventForm.renderForm({
      eventId: 'cb5bdc6d-f734-43e2-a025-b5d89a5ba3fc' as UUID,
      eventType: 'AreaCreated',
      eventActor: 'System',
      eventRecordedAt: '1991-02-20T00:00:00.000Z',
      eventPayload: JSON.stringify({name: 'Craft room'}, null, 2) as NonEmptyString,
      next: '/event-log?offset=10',
    });

    const body = document.createElement('body');
    body.innerHTML = rendered.body;

    expect(body.textContent).toContain('cb5bdc6d-f734-43e2-a025-b5d89a5ba3fc');
    expect(body.textContent).toContain('AreaCreated');
    expect(body.textContent).toContain('System');
    expect(body.textContent).toContain('1991-02-20T00:00:00.000Z');
    expect(body.textContent).toContain('"name": "Craft room"');
  });
});
