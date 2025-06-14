import pino from 'pino';
import * as O from 'fp-ts/Option';
import {extractGoogleSheetData} from '../../src/google/google';
import {UUID} from 'io-ts-types';
import {getSomeOrFail} from '../helpers';

describe('extractGoogleSheetData', () => {
  it('Extract google sheet data, missing columns', () => {
    const results = extractGoogleSheetData(
      pino({level: 'silent'}),
      'ABC123',
      'deb0a681-d5f9-4e89-bd0c-e7a0d361c350' as UUID,
      {
        name: 'Baked Beans',
        rowCount: 21,
        mappedColumns: {
          // All mapped columns are outwith the columns provided.
          timestamp: 2,
          score: 2,
          email: O.some(2),
          memberNumber: O.some(2),
        },
      },
      'Europe/London'
    )({
      sheets: [
        {
          data: [
            {
              rowData: [
                {
                  values: [
                    {
                      formattedValue: 'beans',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    // Check that no valid results are produced but that we don't error.
    expect(getSomeOrFail(results)).toHaveLength(0);
  });
});
