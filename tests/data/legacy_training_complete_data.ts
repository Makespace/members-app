import {sheets_v4} from '@googleapis/sheets';
import {readFileSync} from 'node:fs';

interface ManualParsedEntry {}

interface ManualParsed {
  data: sheets_v4.Schema$Spreadsheet;
  entries: ManualParsedEntry[];
}

export const LEGACY_TRAINING_COMPLETE: ManualParsed = {
  data: JSON.parse(
    readFileSync('./tests/data/legacy_training_sheet.json', 'utf8')
  ) as sheets_v4.Schema$Spreadsheet,
  entries: [],
};
