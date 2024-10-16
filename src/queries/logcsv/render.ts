import {ViewModel} from './view-model';
import {Actor} from '../../types/actor';

const renderActor = (actor: Actor) => {
  switch (actor.tag) {
    case 'system':
      return 'system';
    case 'token':
      return 'api';
    case 'user':
      return actor.user.emailAddress;
  }
};

function escapeCsv(cell: string): string {
  let requiresEscaping = false;
  for (let i = 0; i < cell.length; ++i) {
    const c = cell[i];
    if (c === '"' || c === '\n' || c === ',') {
      requiresEscaping = true;
      break;
    }
  }

  if (requiresEscaping) {
    const escaped = cell.replace(/"/g, '""');
    return `"${escaped}"`;
  } else {
    return cell;
  }
}

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
