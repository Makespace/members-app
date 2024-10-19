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
