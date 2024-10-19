import {ViewModel} from './view-model';
import {escapeCsv, renderActor} from '../../csv';

export const render = (viewModel: ViewModel) => {
  const rows = [];
  rows.push(['recordedAt', 'type', 'actor', 'payload'].join(','));
  for (const event of viewModel.events) {
    const {recordedAt, type, actor, ...payload} = event;
    const row = [
      recordedAt.toISOString(),
      type,
      renderActor(actor),
      JSON.stringify(payload),
    ];
    rows.push(row.map(escapeCsv).join(','));
  }
  return rows.join('\n');
};
