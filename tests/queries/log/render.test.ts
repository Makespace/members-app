/**
 * @jest-environment jsdom
 */

import {render} from '../../../src/queries/log/render';
import {ViewModel} from '../../../src/queries/log/view-model';
import {arbitraryUser} from '../../types/user.helper';
import {NonEmptyString, UUID} from 'io-ts-types';

const renderPage = (viewModel: ViewModel) => {
  const body = document.createElement('body');
  body.innerHTML = render(viewModel);
  return body;
};

describe('/event-log render', () => {
  it('shows the event id for each event', () => {
    const viewModel: ViewModel = {
      user: arbitraryUser(),
      count: 1,
      search: {
        offset: 0,
        limit: 10,
      },
      events: [
        {
          event_index: 42,
          event_id: 'cb5bdc6d-f734-43e2-a025-b5d89a5ba3fc' as UUID,
          type: 'AreaCreated',
          actor: {tag: 'system'},
          recordedAt: new Date('1991-02-20T00:00:00.000Z'),
          name: 'Craft room',
          id: 'd1428735-0482-49c4-b16b-82503ccea74b' as UUID,
          deletion: null,
        },
      ],
    };

    const page = renderPage(viewModel);

    expect(page.textContent).toContain('Event ID:');
    expect(page.textContent).toContain('Event Index:');
    expect(page.textContent).toContain('42');
    expect(page.textContent).toContain('cb5bdc6d-f734-43e2-a025-b5d89a5ba3fc');
    expect(page.textContent).not.toContain('event_id:');
    expect(page.textContent).not.toContain('event_index:');
    const deleteLink = page.querySelector(
      'a[href*="/event-log/delete?"]'
    )! as HTMLAnchorElement;

    expect(deleteLink.textContent).toContain('Delete event');
    expect(deleteLink.href).toContain(
      'eventId=cb5bdc6d-f734-43e2-a025-b5d89a5ba3fc'
    );
    expect(deleteLink.href).not.toContain('eventType=');
    expect(deleteLink.href).not.toContain('eventActor=');
    expect(deleteLink.href).not.toContain('eventRecordedAt=');
    expect(deleteLink.href).not.toContain('eventPayload=');
    expect(deleteLink.href).not.toContain('next=');
  });

  it('shows deletion details instead of a delete form for deleted events', () => {
    const viewModel: ViewModel = {
      user: arbitraryUser(),
      count: 1,
      search: {
        offset: 0,
        limit: 10,
      },
      events: [
        {
          event_index: 42,
          event_id: 'cb5bdc6d-f734-43e2-a025-b5d89a5ba3fc' as UUID,
          type: 'AreaCreated',
          actor: {tag: 'system'},
          recordedAt: new Date('1991-02-20T00:00:00.000Z'),
          name: 'Craft room',
          id: 'd1428735-0482-49c4-b16b-82503ccea74b' as UUID,
          deletion: {
            eventId: 'cb5bdc6d-f734-43e2-a025-b5d89a5ba3fc' as UUID,
            deletedAt: new Date('1991-02-21T00:00:00.000Z'),
            deletedByMemberNumber: 1234,
            reason: 'Incorrectly committed' as NonEmptyString,
          },
        },
      ],
    };

    const page = renderPage(viewModel);

    expect(page.textContent).toContain('Deleted');
    expect(page.textContent).toContain('Incorrectly committed');
    expect(page.textContent).not.toContain('Delete event');
  });
});
