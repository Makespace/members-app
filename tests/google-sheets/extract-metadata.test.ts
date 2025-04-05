import pino from 'pino';
import * as O from 'fp-ts/Option';
import {extractGoogleSheetMetadata} from '../../src/google/extract-metadata';

import * as gsheetData from '../data/google_sheet_data';
import {getSomeOrFail} from '../helpers';

describe('extract metadata', () => {
  it('Empty sheet', () => {
    const metadata = gsheetData.EMPTY.metadata;
    const result = getSomeOrFail(
      extractGoogleSheetMetadata(pino({level: 'silent'}))(
        metadata.sheets[0],
        Object.values(gsheetData.EMPTY.sheets)[0]
      )
    );

    expect(result.name).toStrictEqual('Form Responses 1');
    expect(result.rowCount).toStrictEqual(1);
    expect(result.mappedColumns.timestamp).toStrictEqual(0);
    expect(result.mappedColumns.email).toStrictEqual(O.some(1));
    expect(result.mappedColumns.score).toStrictEqual(2);
    expect(result.mappedColumns.memberNumber).toStrictEqual(O.some(4));
  });
});
