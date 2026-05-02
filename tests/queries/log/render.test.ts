/**
 * @jest-environment jsdom
 */

import { Int } from 'io-ts';
import {render} from '../../../src/queries/log/render';
import {ViewModel} from '../../../src/queries/log/view-model';
import {arbitraryUser} from '../../types/user.helper';
import {UUID} from 'io-ts-types';

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
          event_index: 42 as Int,
          event_id: 'cb5bdc6d-f734-43e2-a025-b5d89a5ba3fc' as UUID,
          type: 'AreaCreated',
          actor: {tag: 'system'},
          recordedAt: new Date('1991-02-20T00:00:00.000Z'),
          name: 'Craft room',
          id: 'd1428735-0482-49c4-b16b-82503ccea74b' as UUID,
          deletedAt: null,
          deleteReason: null,
          markDeletedByMemberNumber: null,
        },
      ],
    };

    const page = renderPage(viewModel);

    expect(page.textContent).toContain('Event ID:');
    expect(page.textContent).toContain('Event Index:');
    expect(page.textContent).toContain('42');
    expect(page.textContent).toContain('cb5bdc6d-f734-43e2-a025-b5d89a5ba3fc');
    expect(page.textContent).toContain('Delete event');
    expect(page.textContent).toContain('View deleted events');
    expect(page.textContent).not.toContain('event_id:');
    expect(page.textContent).not.toContain('event_index:');
  });
});
