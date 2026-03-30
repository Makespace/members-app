import {render} from '../../../src/queries/logcsv/render';
import {ViewModel} from '../../../src/queries/logcsv/view-model';
import {arbitraryUser} from '../../types/user.helper';
import {NonEmptyString, UUID} from 'io-ts-types';

describe('/event-log.csv render', () => {
  it('includes deletion columns for deleted and active events', () => {
    const viewModel: ViewModel = {
      events: [
        {
          event_index: 1,
          event_id: 'cb5bdc6d-f734-43e2-a025-b5d89a5ba3fc' as UUID,
          type: 'AreaCreated',
          actor: {tag: 'user', user: arbitraryUser()},
          recordedAt: new Date('1991-02-20T00:00:00.000Z'),
          name: 'Craft room',
          id: 'd1428735-0482-49c4-b16b-82503ccea74b' as UUID,
          deletion: null,
        },
        {
          event_index: 2,
          event_id: 'db5bdc6d-f734-43e2-a025-b5d89a5ba3fc' as UUID,
          type: 'AreaRemoved',
          actor: {tag: 'system'},
          recordedAt: new Date('1991-02-21T00:00:00.000Z'),
          id: 'd1428735-0482-49c4-b16b-82503ccea74b' as UUID,
          deletion: {
            eventId: 'db5bdc6d-f734-43e2-a025-b5d89a5ba3fc' as UUID,
            deletedAt: new Date('1991-02-22T00:00:00.000Z'),
            deletedByMemberNumber: 1234,
            reason: 'Incorrectly committed' as NonEmptyString,
          },
        },
      ],
    };

    const csv = render(viewModel);

    expect(csv).toContain(
      'recordedAt,type,actor,deleted,deletedAt,deletedByMemberNumber,deletionReason,payload'
    );
    expect(csv).toContain('1991-02-20T00:00:00.000Z,AreaCreated');
    expect(csv).toContain(',false,,,,' );
    expect(csv).toContain('1991-02-21T00:00:00.000Z,AreaRemoved');
    expect(csv).toContain(
      'true,1991-02-22T00:00:00.000Z,1234,Incorrectly committed'
    );
  });
});
