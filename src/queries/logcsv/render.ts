import {ViewModel} from './view-model';
import {escapeCsv} from '../../csv';
import {renderActor} from '../../types/actor';

export const render = (viewModel: ViewModel) => {
  const rows = [];
  rows.push(
    [
      'recordedAt',
      'type',
      'actor',
      'payload',
      'deleted',
      'deletedBy',
      'deletedReason',
    ].join(',')
  );
  for (const event of viewModel.events) {
    const {recordedAt, type, actor, deleted, ...payload} = event;
    const row = [
      recordedAt.toISOString(),
      type,
      renderActor(actor),
      JSON.stringify(payload),
      deleted === null ? 'false' : 'true',
      deleted === null ? '' : renderActor(deleted.deletedBy),
      deleted === null ? '' : deleted.reason,
    ];
    rows.push(row.map(escapeCsv).join(','));
  }
  return rows.join('\n');
};
