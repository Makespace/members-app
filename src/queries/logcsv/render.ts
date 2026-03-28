import {ViewModel} from './view-model';
import {escapeCsv} from '../../csv';
import {renderActor} from '../../types/actor';

export const render = (viewModel: ViewModel) => {
  const rows = [];
  rows.push(['event_id', 'recordedAt', 'type', 'actor', 'payload'].join(','));
  for (const event of viewModel.events) {
    const {event_id, recordedAt, type, actor, ...payload} = event;
    const row = [
      event_id,
      recordedAt.toISOString(),
      type,
      renderActor(actor),
      JSON.stringify(payload),
    ];
    rows.push(row.map(escapeCsv).join(','));
  }
  return rows.join('\n');
};
