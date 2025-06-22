import {
  GoogleHelpers,
  pullGoogleSheetData,
  pullGoogleSheetDataMetadata,
} from '../../src/sync-worker/google/pull_sheet_data';
import {
  syncTrainingSheet,
  SyncTrainingSheetDependencies,
} from '../../src/sync-worker/sync_training_sheet';
import {Client, createClient} from '@libsql/client/.';

import {getRightOrFail, getSomeOrFail} from '../helpers';
import {ensureGoogleDBTablesExist} from '../../src/sync-worker/google/ensure-sheet-data-tables-exist';
import {ensureEventTableExists} from '../../src/init-dependencies/event-store/ensure-events-table-exists';
import {getSheetData} from '../../src/sync-worker/db/get_sheet_data';
import {createSyncTrainingSheetDependencies, testLogger} from './util';
import {GoogleAuth} from 'google-auth-library';
import {pipe} from 'fp-ts/lib/function';
import * as RA from 'fp-ts/ReadonlyArray';

const CREDENTIALS_PATH = '../test-google/credentials_new.json.ignore';
const TEST_USER = 1741;

describe('Google training sheet integration', () => {
  // These tests should be used sparingly because they actually query the real
  // google api for data.
  let googleDB: Client;
  let eventDB: Client;
  let deps: SyncTrainingSheetDependencies;
  let google: GoogleHelpers;

  beforeEach(async () => {
    googleDB = createClient({url: ':memory:'});
    eventDB = createClient({url: ':memory:'});
    deps = createSyncTrainingSheetDependencies(googleDB, eventDB, testLogger());
    getRightOrFail(await ensureEventTableExists(eventDB)());
    await ensureGoogleDBTablesExist(googleDB)();

    const auth = new GoogleAuth({
      keyFile: CREDENTIALS_PATH,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    google = {
      pullGoogleSheetData: pullGoogleSheetData(auth),
      pullGoogleSheetDataMetadata: pullGoogleSheetDataMetadata(auth),
    };
  });

  it.skip('Form 3 Resin Printer', async () => {
    const sheetId = '1rnG8qvYXL5CucsS7swr9ajGYvHndBG1TKIbyG3KioHc';
    await syncTrainingSheet(testLogger(), deps, google, sheetId);
    const producedData = getRightOrFail(
      await getSheetData(googleDB)(sheetId)()
    );
    const userEvent = getSomeOrFail(
      pipe(
        producedData,
        RA.findFirst(
          row =>
            row.member_number_provided === TEST_USER && row.percentage === 100
        )
      )
    );
    expect(userEvent.response_submitted.getTime()).toStrictEqual(1726008048000);
  });
});
