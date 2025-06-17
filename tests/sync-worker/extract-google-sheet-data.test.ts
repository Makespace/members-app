import pino from 'pino';
import * as O from 'fp-ts/Option';
import {extractGoogleSheetData} from '../../src/sync-worker/sync_training_sheet';

describe('extractGoogleSheetData', () => {
  it('Extract google sheet data, missing columns', () => {
    const results = extractGoogleSheetData(
      pino({level: 'silent'}),
      'ABC123',
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
      'Europe/London',
      {
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
      },
      1
    );
    // Check that no valid results are produced but that we don't error.
    expect(results).toHaveLength(0);
  });
});
