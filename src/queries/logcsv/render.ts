import {ViewModel} from './view-model';
import {escapeCsv} from '../../csv';
import {renderActor} from '../../types/actor';

export const render = (viewModel: ViewModel) => {
  const rows = [];
  rows.push([
    'recordedAt',
    'type',
    'actor',
    'deleted',
    'deletedAt',
    'deletedByMemberNumber',
    'deletionReason',
    'payload',
  ].join(','));
  for (const event of viewModel.events) {
    const {recordedAt, type, actor, deletion, ...payload} = event;
    const row = [
      recordedAt.toISOString(),
      type,
      renderActor(actor),
      deletion === null ? 'false' : 'true',
      deletion?.deletedAt.toISOString() ?? '',
      deletion?.deletedByMemberNumber ?? '',
      deletion?.reason ?? '',
      JSON.stringify(payload),
    ];
    rows.push(row.map(escapeCsv).join(','));
  }
  return rows.join('\n');
};
