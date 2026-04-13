import {
  GoogleHelpers,
  pullGoogleSheetData,
  pullGoogleSheetDataMetadata,
} from '../../src/sync-worker/google/pull_sheet_data';
import {testLogger} from './util';
import {GoogleAuth} from 'google-auth-library';
import parse from 'dotenv';
import {existsSync, readFileSync} from 'fs';

// This is setup for testing within the makespace google drive structure.
const STAGING_TEST_SHEET_ID = '19e610we8nSzo3QO-T76RzdVoCNjq75my4Fkc0eDgmSo';

describe('Google sheet integration', () => {
  const env = existsSync('./.env') ? parse.parse(readFileSync('./.env')) : null;

  // These tests should be used sparingly because they actually query the real
  // google api for data.
  let google: GoogleHelpers;

  beforeEach(() => {
    const auth = new GoogleAuth({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      credentials: JSON.parse(env!.GOOGLE_SERVICE_ACCOUNT_KEY_JSON),
      clientOptions: {transporterOptions: {fetchImplementation: fetch}},
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    google = {
      pullGoogleSheetData: pullGoogleSheetData(auth),
      pullGoogleSheetDataMetadata: pullGoogleSheetDataMetadata(auth),
    };
  });

  const testIfCreds = (testname: string, fn: jest.ProvidesCallback) => {
    // Only run the test if the credentials have been configured.
    if (env && env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON && env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON !== "{}") {
      it(testname, fn);
    } else {
      it.skip(testname, fn);
    }
  };

  testIfCreds('pulls metadata and row data from Google sheets', async () => {
    const metadata = await google.pullGoogleSheetDataMetadata(
      testLogger(),
      STAGING_TEST_SHEET_ID
    );
    expect(metadata.sheets.map(sheet => sheet.properties.title)).toContain(
      'Form Responses 1'
    );

    const data = await google.pullGoogleSheetData(
      testLogger(),
      STAGING_TEST_SHEET_ID,
      'Form Responses 1',
      1,
      3,
      0,
      4
    );
    const rows = data.sheets[0].data[0].rowData;
    if (!rows || rows.length !== 3) {
      throw new Error('Expected three rows from Google sheets');
    }
    const [header, firstRow, secondRow] = rows;
    if (!('values' in header) || !('values' in firstRow) || !('values' in secondRow)) {
      throw new Error('Expected row values from Google sheets');
    }
    expect(header.values[0].formattedValue).toStrictEqual('Timestamp');
    expect(header.values[1].formattedValue).toStrictEqual('Email');
    expect(header.values[2].formattedValue).toStrictEqual('Score');
    expect(firstRow.values[0].formattedValue).toStrictEqual('24/02/2026 16:57:25');
    expect(secondRow.values[0].formattedValue).toStrictEqual('15/05/2026 18:24:45');
  });
});
