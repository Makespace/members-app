import {sheets_v4} from '@googleapis/sheets';
import {readFileSync} from 'node:fs';
import {EpochTimestampMilliseconds} from '../../src/read-models/shared-state/return-types';

type ManualParsedEntry = {
  emailProvided: string;
  memberNumberProvided: number;
  score: number;
  maxScore: number;
  percentage: number;
  fullMarks: boolean;
  timestampEpochMS: EpochTimestampMilliseconds;
};

export type ManualParsed = {
  data: sheets_v4.Schema$Spreadsheet;
  entries: ManualParsedEntry[];
};

export const EMPTY: ManualParsed = {
  data: JSON.parse(
    readFileSync('./tests/data/google_spreadsheets_empty.json', 'utf8')
  ) as sheets_v4.Schema$Spreadsheet,
  entries: [],
};
export const METAL_LATHE: ManualParsed = {
  data: JSON.parse(
    readFileSync('./tests/data/google_spreadsheets_metal_lathe.json', 'utf8')
  ) as sheets_v4.Schema$Spreadsheet,
  // Manually parsed data for testing:
  entries: [
    {
      emailProvided: 'test@makespace.com',
      memberNumberProvided: 1234,
      score: 13,
      maxScore: 14,
      percentage: 93,
      fullMarks: false,
      timestampEpochMS: 1705770960_000 as EpochTimestampMilliseconds,
    },
  ],
};

export const BAMBU: ManualParsed = {
  data: JSON.parse(
    readFileSync('./tests/data/google_spreadsheets_bambu.json', 'utf8')
  ) as sheets_v4.Schema$Spreadsheet,
  entries: [
    // Manually parsed data for testing:
    {
      emailProvided: 'flonn@example.com',
      memberNumberProvided: 2222,
      score: 4,
      maxScore: 5,
      percentage: 80,
      fullMarks: false,
      timestampEpochMS: 1700768963_000 as EpochTimestampMilliseconds,
    },
    {
      emailProvided: 'flonn@example.com',
      memberNumberProvided: 2222,
      score: 5,
      maxScore: 5,
      percentage: 100,
      fullMarks: true,
      timestampEpochMS: 1700769348_000 as EpochTimestampMilliseconds,
    },
    {
      emailProvided: 'flonn@example.com',
      memberNumberProvided: 2222,
      score: 12,
      maxScore: 12,
      percentage: 100,
      fullMarks: true,
      timestampEpochMS: 1710249052_000 as EpochTimestampMilliseconds,
    },
    {
      emailProvided: 'flonn@example.com',
      memberNumberProvided: 2222,
      score: 12,
      maxScore: 12,
      percentage: 100,
      fullMarks: true,
      timestampEpochMS: 1710249842_000 as EpochTimestampMilliseconds,
    },
  ],
};
export const LASER_CUTTER: ManualParsed = {
  data: JSON.parse(
    readFileSync('./tests/data/google_spreadsheets_laser_cutter.json', 'utf8')
  ) as sheets_v4.Schema$Spreadsheet,
  entries: [
    // Manually parsed data for testing
    // Note some entries were missing in the source spreadsheet so are treated as '' to match the spreadsheet behaviour.
    {
      emailProvided: 'sparky@example.com',
      memberNumberProvided: 1111,
      score: 24,
      maxScore: 24,
      percentage: 100,
      fullMarks: true,
      timestampEpochMS: 1601214546_000 as EpochTimestampMilliseconds,
    },
    {
      emailProvided: 'flonn@example.com',
      memberNumberProvided: 1111,
      score: 24,
      maxScore: 24,
      percentage: 100,
      fullMarks: true,
      timestampEpochMS: 1601298462_000 as EpochTimestampMilliseconds,
    },
  ],
};

export const getLatestEvent = (data: ManualParsed) =>
  data.entries.sort((a, b) => a.timestampEpochMS - b.timestampEpochMS)[
    data.entries.length - 1
  ];

export const NOT_FOUND_ERROR = {
  errors: [
    {
      message: 'Requested entity was not found.',
      domain: 'global',
      reason: 'notFound',
    },
  ],
  code: '404',
};
export const TRAINING_SHEETS = {
  [EMPTY.data.spreadsheetId!]: EMPTY,
  [METAL_LATHE.data.spreadsheetId!]: METAL_LATHE,
  [LASER_CUTTER.data.spreadsheetId!]: LASER_CUTTER,
  [BAMBU.data.spreadsheetId!]: BAMBU,
};
