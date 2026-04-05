/**
 * @jest-environment jsdom
 */

import {UUID} from 'io-ts-types';
import {render} from '../../../src/queries/failed-event-log/render';
import {ViewModel} from '../../../src/queries/failed-event-log/view-model';
import {arbitraryUser} from '../../types/user.helper';

const renderPage = (viewModel: ViewModel) => {
  const body = document.createElement('body');
  body.innerHTML = render(viewModel);
  return body;
};

describe('/event-log/failed render', () => {
  it('shows the failed event details for each event', () => {
    const viewModel: ViewModel = {
      user: arbitraryUser(),
      count: 1,
      search: {
        offset: 0,
        limit: 10,
      },
      failures: [
        {
          error: 'SQLITE_CONSTRAINT_FOREIGNKEY',
          payload: {
            event_index: 42,
            event_id: 'cb5bdc6d-f734-43e2-a025-b5d89a5ba3fc' as UUID,
            type: 'AreaCreated',
            actor: {tag: 'system'},
            recordedAt: new Date('1991-02-20T00:00:00.000Z'),
            name: 'Craft room',
            id: 'd1428735-0482-49c4-b16b-82503ccea74b' as UUID,
          },
        },
      ],
    };

    const page = renderPage(viewModel);

    expect(page.textContent).toContain('Failed event log');
    expect(page.textContent).toContain('42');
    expect(page.textContent).toContain('cb5bdc6d-f734-43e2-a025-b5d89a5ba3fc');
    expect(page.textContent).toContain('SQLITE_CONSTRAINT_FOREIGNKEY');
    expect(page.textContent).not.toContain('event_id:');
    expect(page.textContent).not.toContain('event_index:');
  });
});
