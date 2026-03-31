import {UUID} from 'io-ts-types';
import {render} from '../../../src/queries/logcsv/render';
import {ViewModel} from '../../../src/queries/logcsv/view-model';
import {arbitraryActor} from '../../helpers';

describe('/event-log.csv render', () => {
  it('includes deletion metadata columns', () => {
    const csv = render({
      events: [
        {
          deleted: {
            event_id: 'cb5bdc6d-f734-43e2-a025-b5d89a5ba3fc' as UUID,
            deletedAt: new Date('1991-02-21T00:00:00.000Z'),
            deletedBy: arbitraryActor(),
            reason: 'cleanup',
          },
          event_index: 42,
          event_id: 'cb5bdc6d-f734-43e2-a025-b5d89a5ba3fc' as UUID,
          type: 'AreaCreated',
          actor: {tag: 'system'},
          recordedAt: new Date('1991-02-20T00:00:00.000Z'),
          name: 'Craft room',
          id: 'd1428735-0482-49c4-b16b-82503ccea74b' as UUID,
        },
      ],
    } satisfies ViewModel);

    expect(csv).toContain('deleted,deletedBy,deletedReason');
    expect(csv).toContain('true');
    expect(csv).toContain('cleanup');
  });
});
