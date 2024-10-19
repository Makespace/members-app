import {Actor} from './types';

export const renderActor = (actor: Actor) => {
  switch (actor.tag) {
    case 'system':
      return 'system';
    case 'token':
      return 'api';
    case 'user':
      return actor.user.emailAddress;
  }
};

export function escapeCsv(cell: string | number): string {
  if (typeof cell === 'number') {
    return cell.toString();
  }
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
