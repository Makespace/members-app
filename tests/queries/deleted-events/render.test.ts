/**
 * @jest-environment jsdom
 */

import { faker } from '@faker-js/faker/locale/af_ZA';
import {render} from '../../../src/queries/deleted-events/render';
import {ViewModel} from '../../../src/queries/deleted-events/view-model';
import {arbitraryUser} from '../../types/user.helper';
import {UUID} from 'io-ts-types';
import { Int } from 'io-ts';

const renderPage = (viewModel: ViewModel) => {
  const body = document.createElement('body');
  body.innerHTML = render(viewModel);
  return body;
};

describe('/event-log/deleted render', () => {
  it('shows the deleted event details for each event', () => {
    const viewModel: ViewModel = {
      user: arbitraryUser(),
      events: [
        {
          event_index: 42 as Int,
          event_id: 'cb5bdc6d-f734-43e2-a025-b5d89a5ba3fc' as UUID,
          type: 'AreaCreated',
          actor: {tag: 'system'},
          recordedAt: new Date('1991-02-20T00:00:00.000Z'),
          deletedAt: new Date('1991-02-21T00:00:00.000Z'),
          deleteReason: faker.lorem.sentence(),
          markDeletedByMemberNumber: faker.number.int() as Int,
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
    expect(page.textContent).toContain('Reason');
    expect(page.textContent).toContain('Deleted by');
    expect(page.textContent).not.toContain('event_id:');
    expect(page.textContent).not.toContain('event_index:');
    expect(page.querySelector('form')?.getAttribute('method')).toStrictEqual(
      'get'
    );
    expect(page.querySelector('form')?.getAttribute('action')).toContain(
      '/event-log/undelete?eventIndex=42'
    );
  });
});
