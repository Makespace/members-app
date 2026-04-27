/**
 * @jest-environment jsdom
 */

import {render} from '../../../src/queries/deleted-events/render';
import {ViewModel} from '../../../src/queries/deleted-events/view-model';
import {arbitraryUser} from '../../types/user.helper';
import {UUID} from 'io-ts-types';

const renderPage = (viewModel: ViewModel) => {
  const body = document.createElement('body');
  body.innerHTML = render(viewModel);
  return body;
};

describe('/event-log/deleted render', () => {
  it('shows the deleted event details for each event', () => {
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
          deletedAt: new Date('1991-02-21T00:00:00.000Z'),
          name: 'Craft room',
          id: 'd1428735-0482-49c4-b16b-82503ccea74b' as UUID,
        },
      ],
    };

    const page = renderPage(viewModel);

    expect(page.textContent).toContain('Deleted events');
    expect(page.textContent).toContain('42');
    expect(page.textContent).toContain('cb5bdc6d-f734-43e2-a025-b5d89a5ba3fc');
    expect(page.textContent).toContain('Un-delete event');
    expect(page.textContent).toContain('Deleted at');
    expect(page.textContent).not.toContain('event_id:');
    expect(page.textContent).not.toContain('event_index:');
  });
});
