import {sheets_v4} from 'googleapis/build/src/apis/sheets/v4';
import {readFileSync} from 'node:fs';

export const EMPTY = JSON.parse(
  readFileSync('./tests/data/google_spreadsheets_empty.json', 'utf8')
) as sheets_v4.Schema$Spreadsheet;
export const METAL_LATHE = JSON.parse(
  readFileSync('./tests/data/google_spreadsheets_metal_lathe.json', 'utf8')
) as sheets_v4.Schema$Spreadsheet;
