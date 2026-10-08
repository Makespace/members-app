import * as O from 'fp-ts/Option';
import {parseCsv} from '../../src/csv';
import {decodeExport, parsePaxtonExport} from '../../src/paxton/parse-export';
import {getLeftOrFail, getRightOrFail} from '../helpers';

describe('parseCsv', () => {
  it('splits plain rows on commas and newlines', () => {
    expect(parseCsv('a,b\nc,d\n')).toStrictEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('keeps commas, doubled quotes and newlines inside quoted cells', () => {
    expect(parseCsv('"Millions, Molly","say ""hi""","two\nlines"')).toStrictEqual(
      [['Millions, Molly', 'say "hi"', 'two\nlines']]
    );
  });

  it('accepts CRLF line endings and drops blank lines', () => {
    expect(parseCsv('a,b\r\n\r\nc,d\r\n')).toStrictEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });
});

describe('decodeExport', () => {
  it('reads valid UTF-8 as UTF-8', () => {
    expect(decodeExport(new TextEncoder().encode('Émilie'))).toStrictEqual(
      'Émilie'
    );
  });

  it('falls back to Windows-1252 for a Paxton export', () => {
    // "É" in cp1252 is a lone 0xC9, which is not valid UTF-8.
    expect(decodeExport(new Uint8Array([0xc9, 0x6d, 0x69, 0x6c, 0x69, 0x65]))).toStrictEqual('Émilie');
  });
});

describe('parsePaxtonExport', () => {
  const header = '"User name","Department","Token number","Date/time"\n';

  it('reads the four Paxton columns', () => {
    const rows = getRightOrFail(
      parsePaxtonExport(
        header +
          '"Millions, Molly 1337","1a - Active Members",35424000,"09/12/2012 16:08:02"\n'
      )
    );
    expect(rows).toStrictEqual([
      {
        paxtonName: 'Millions, Molly 1337',
        accessLevel: '1a - Active Members',
        fobId: 35424000,
        addedAt: O.some(new Date(Date.UTC(2012, 11, 9, 16, 8, 2))),
      },
    ]);
  });

  it('finds columns by header name regardless of order and case', () => {
    const rows = getRightOrFail(
      parsePaxtonExport(
        'Token Number,user name,DEPARTMENT\n1,"Case, Henry",3 - Cancelled Members\n'
      )
    );
    expect(rows[0]).toMatchObject({
      paxtonName: 'Case, Henry',
      accessLevel: '3 - Cancelled Members',
      fobId: 1,
      addedAt: O.none,
    });
  });

  it('collapses stray whitespace in names', () => {
    const rows = getRightOrFail(
      parsePaxtonExport(header + '"Case,\tHenry  1","1a",2,""\n')
    );
    expect(rows[0].paxtonName).toStrictEqual('Case, Henry 1');
  });

  it('rejects a file without the Paxton columns', () => {
    expect(
      getLeftOrFail(parsePaxtonExport('memberNumber,fobId\n1,2\n'))
    ).toContain('does not look like a Paxton token export');
  });

  it('rejects a non-numeric token number', () => {
    expect(
      getLeftOrFail(parsePaxtonExport(header + '"Case, Henry","1a",abc,""\n'))
    ).toContain('Row 2');
  });

  it('rejects an empty file', () => {
    expect(getLeftOrFail(parsePaxtonExport(''))).toContain('empty');
  });
});
