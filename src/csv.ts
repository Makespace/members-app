import * as O from 'fp-ts/Option';

export function escapeCsv(
  cell: string | number | boolean | O.None | O.Some<string | number | boolean>
): string {
  if (typeof cell === 'number') {
    return cell.toString();
  }
  if (typeof cell === 'boolean') {
    return cell ? 'true' : 'false';
  }
  if (typeof cell === 'object') {
    return O.isNone(cell) ? '' : escapeCsv(cell.value);
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
