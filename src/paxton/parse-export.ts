import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {Int} from 'io-ts';
import {parseCsv} from '../csv';

// One row of the token export from the Paxton PC (Users > export): the
// holder's name as typed into Paxton, their access level (Paxton calls it a
// department), the fob's number, and when the fob was added.
export type PaxtonFobRow = {
  paxtonName: string;
  accessLevel: string;
  fobId: Int;
  addedAt: O.Option<Date>;
};

const REQUIRED_COLUMNS = {
  paxtonName: 'user name',
  accessLevel: 'department',
  fobId: 'token number',
} as const;

const OPTIONAL_COLUMNS = {
  addedAt: 'date/time',
} as const;

// Paxton writes the export in Windows-1252, not UTF-8, so accented names
// would otherwise come through mangled. Prefer UTF-8 when the bytes are
// valid UTF-8 (a hand-edited or re-saved file), else fall back.
export const decodeExport = (bytes: Uint8Array): string => {
  try {
    return new TextDecoder('utf-8', {fatal: true, ignoreBOM: false}).decode(
      bytes
    );
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
};

// dd/mm/yyyy hh:mm:ss as Paxton writes it.
const parseAddedAt = (cell: string): O.Option<Date> => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})(?: (\d{2}):(\d{2}):(\d{2}))?$/.exec(
    cell.trim()
  );
  if (!m) {
    return O.none;
  }
  const [, dd, mm, yyyy, hh = '0', mi = '0', ss = '0'] = m;
  const date = new Date(
    Date.UTC(+yyyy, +mm - 1, +dd, +hh, +mi, +ss)
  );
  return isNaN(date.getTime()) ? O.none : O.some(date);
};

const findColumn = (
  header: ReadonlyArray<string>,
  name: string
): O.Option<number> => {
  const index = header.findIndex(h => h.trim().toLowerCase() === name);
  return index === -1 ? O.none : O.some(index);
};

export const parsePaxtonExport = (
  text: string
): E.Either<string, ReadonlyArray<PaxtonFobRow>> => {
  const [header, ...rows] = parseCsv(text);
  if (header === undefined) {
    return E.left('The file is empty');
  }
  const columns = {
    paxtonName: findColumn(header, REQUIRED_COLUMNS.paxtonName),
    accessLevel: findColumn(header, REQUIRED_COLUMNS.accessLevel),
    fobId: findColumn(header, REQUIRED_COLUMNS.fobId),
    addedAt: findColumn(header, OPTIONAL_COLUMNS.addedAt),
  };
  const missing = (Object.keys(REQUIRED_COLUMNS) as Array<keyof typeof REQUIRED_COLUMNS>)
    .filter(key => O.isNone(columns[key]))
    .map(key => `"${REQUIRED_COLUMNS[key]}"`);
  if (missing.length > 0) {
    return E.left(
      `The file does not look like a Paxton token export: no ${missing.join(
        ', '
      )} column. Found: ${header.map(h => `"${h.trim()}"`).join(', ')}`
    );
  }
  const cell = (row: ReadonlyArray<string>, column: O.Option<number>) =>
    O.isSome(column) ? (row[column.value] ?? '').trim() : '';

  const parsed: PaxtonFobRow[] = [];
  for (const [i, row] of rows.entries()) {
    const fobCell = cell(row, columns.fobId);
    if (!/^\d+$/.test(fobCell)) {
      return E.left(
        `Row ${i + 2}: token number "${fobCell}" is not a whole number`
      );
    }
    parsed.push({
      // Collapse runs of whitespace: Paxton names come through with the odd
      // tab or doubled space.
      paxtonName: cell(row, columns.paxtonName).split(/\s+/).join(' '),
      accessLevel: cell(row, columns.accessLevel),
      fobId: Number(fobCell) as Int,
      addedAt: parseAddedAt(cell(row, columns.addedAt)),
    });
  }
  return E.right(parsed);
};
