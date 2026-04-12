import {
  GoogleHelpers,
  pullGoogleSheetData,
  pullGoogleSheetDataMetadata,
} from '../../src/sync-worker/google/pull_sheet_data';
import {testLogger} from './util';
import {GoogleAuth} from 'google-auth-library';
import parse from 'dotenv';
import {readFileSync} from 'fs';

// This is setup for testing within the makespace google drive structure.
const STAGING_TEST_SHEET_ID = '19e610we8nSzo3QO-T76RzdVoCNjq75my4Fkc0eDgmSo';

describe('Google sheet integration', () => {
  const env = parse.parse(readFileSync('./.env'));

  // These tests should be used sparingly because they actually query the real
  // google api for data.
  let google: GoogleHelpers;

  beforeEach(() => {
    const auth = new GoogleAuth({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      credentials: JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON),
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
    if (env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON && env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON !== "{}") {
      it(testname, fn);
    } else {
      it.skip(testname, fn);
    }
  };

  testIfCreds('pulls metadata and row data from Google sheets', async () => {
    const metadata = await google.pullGoogleSheetDataMetadata(STAGING_TEST_SHEET_ID);
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
    const rows = data.sheets[0].data[0].rowData as any;
    expect(rows[0].values[0].formattedValue).toStrictEqual('Timestamp');
    expect(rows[0].values[1].formattedValue).toStrictEqual('Email');
    expect(rows[0].values[2].formattedValue).toStrictEqual('Score');
    expect(rows[1].values[0].formattedValue).toStrictEqual('24/02/2026 16:57:25');
    expect(rows[2].values[0].formattedValue).toStrictEqual('15/05/2026 18:24:45');
  });
});
