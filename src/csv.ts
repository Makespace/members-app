import * as O from 'fp-ts/Option';

// RFC 4180-ish parse: quoted cells may contain commas, newlines and doubled
// quotes; rows end at \n or \r\n. Returns one string array per row,
// dropping rows that are entirely empty.
export const parseCsv = (
  text: string
): ReadonlyArray<ReadonlyArray<string>> => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; ++i) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          ++i;
        } else {
          quoted = false;
        }
      } else {
        cell += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') {
        ++i;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += c;
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter(r => r.some(c => c.trim() !== ''));
};

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
