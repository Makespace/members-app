import {sheets_v4} from '@googleapis/sheets';
import {readFileSync} from 'node:fs';
import {EpochTimestampMilliseconds} from '../../src/read-models/shared-state/return-types';
import {
  GoogleSpreadsheetDataForSheet,
  GoogleSpreadsheetInitialMetadata,
} from '../../src/training-sheets/google/pull_sheet_data';
import {GoogleSheetName} from '../../src/google/extract-metadata';
import {getRightOrFail} from '../helpers';
import {EventOfType} from '../../src/types/domain-event';

export type ManualParsedTrainingSheetEntry = {
  emailProvided: string;
  memberNumberProvided: number;
  score: number;
  maxScore: number;
  percentage: number;
  timestampEpochMS: EpochTimestampMilliseconds;
};

export type ManualParsedTroubleTicketEntry = {
  timestampEpochMs: EpochTimestampMilliseconds;
  emailProvided: string | null;
  whichEquipmentWereYouUsing: string | null;
  ifYouAnsweredOtherAbove: string;
  whatsTheStatusOfTheMachine: string;
  whatWereYouAttemptingToDo: string;
  whatErrorOrIssueDidYouEncounter: string;
  whatStepsDidYouTakeBeforeEncountering: string;
  nameProvided: string | null;
  membershipNumberProvided: number | null;
};

export const manualParsedTroubleTicketToEvent = (
  m: ManualParsedTroubleTicketEntry
): Omit<
  EventOfType<'TroubleTicketResponseSubmitted'>,
  'actor' | 'type' | 'recordedAt'
> => ({
  response_submitted_epoch_ms: m.timestampEpochMs,
  email_address: m.emailProvided,
  which_equipment: m.whichEquipmentWereYouUsing,
  submitter_name: m.nameProvided,
  submitter_membership_number: m.membershipNumberProvided,
  submitted_response: {
    ['If you answered "Other" above or an ABS or PLA 3d printer, please tell us which one. (printers are numbered from the left']:
      m.ifYouAnsweredOtherAbove,
    ["What's the status of the machine?"]: m.whatsTheStatusOfTheMachine,
    ['What were you attempting to do with the machine? Please include details about material or file type and what you expected to happen.']:
      m.whatWereYouAttemptingToDo,
    ['What error or issue did you encounter.  Please include events and observations about what actually happened.']:
      m.whatErrorOrIssueDidYouEncounter,
    ['What steps did you take before encountering the error.  Please include any relevant settings or changes made prior to the error.']:
      m.whatStepsDidYouTakeBeforeEncountering,
  },
});

export type ManualParsed<T> = {
  apiResp: sheets_v4.Schema$Spreadsheet;
  metadata: GoogleSpreadsheetInitialMetadata;
  sheets: Record<GoogleSheetName, GoogleSpreadsheetDataForSheet>;
  entries: T[];
};

const genManualParsed = <T>(
  // Enumlate the google api which filters out other sheets using the range parameter.
  apiResp: sheets_v4.Schema$Spreadsheet,
  entries: T[]
): ManualParsed<T> => {
  const sheets: Record<GoogleSheetName, GoogleSpreadsheetDataForSheet> = {};
  for (const sheet of apiResp.sheets!) {
    const apiRespCopy = JSON.parse(JSON.stringify(apiResp)) as typeof apiResp;
    apiRespCopy.sheets = apiRespCopy.sheets!.filter(
      s => s.properties!.title === sheet.properties!.title
    );
    sheets[sheet.properties!.title as string] = getRightOrFail(
      GoogleSpreadsheetDataForSheet.decode(apiRespCopy)
    );
  }
  return {
    apiResp,
    entries,
    sheets,
    metadata: getRightOrFail(GoogleSpreadsheetInitialMetadata.decode(apiResp)),
  };
};

export const EMPTY = genManualParsed(
  JSON.parse(
    readFileSync('./tests/data/google_spreadsheets_empty.json', 'utf8')
  ) as sheets_v4.Schema$Spreadsheet,
  []
);

export const METAL_LATHE: ManualParsed<ManualParsedTrainingSheetEntry> =
  genManualParsed(
    JSON.parse(
      readFileSync('./tests/data/google_spreadsheets_metal_lathe.json', 'utf8')
    ) as sheets_v4.Schema$Spreadsheet,
    [
      {
        emailProvided: 'test@makespace.com',
        memberNumberProvided: 1234,
        score: 13,
        maxScore: 14,
        percentage: 93,
        timestampEpochMS: 1705770960_000 as EpochTimestampMilliseconds,
      },
    ]
  );

export const BAMBU: ManualParsed<ManualParsedTrainingSheetEntry> =
  genManualParsed(
    JSON.parse(
      readFileSync('./tests/data/google_spreadsheets_bambu.json', 'utf8')
    ) as sheets_v4.Schema$Spreadsheet,
    [
      // Manually parsed data for testing:
      {
        emailProvided: 'flonn@example.com',
        memberNumberProvided: 2222,
        score: 4,
        maxScore: 5,
        percentage: 80,
        timestampEpochMS: 1700768963_000 as EpochTimestampMilliseconds,
      },
      {
        emailProvided: 'flonn@example.com',
        memberNumberProvided: 2222,
        score: 5,
        maxScore: 5,
        percentage: 100,
        timestampEpochMS: 1700769348_000 as EpochTimestampMilliseconds,
      },
      {
        emailProvided: 'flonn@example.com',
        memberNumberProvided: 2222,
        score: 12,
        maxScore: 12,
        percentage: 100,
        timestampEpochMS: 1710249052_000 as EpochTimestampMilliseconds,
      },
      {
        emailProvided: 'flonn@example.com',
        memberNumberProvided: 2222,
        score: 12,
        maxScore: 12,
        percentage: 100,
        timestampEpochMS: 1710249842_000 as EpochTimestampMilliseconds,
      },
    ]
  );

export const LASER_CUTTER: ManualParsed<ManualParsedTrainingSheetEntry> =
  genManualParsed(
    JSON.parse(
      readFileSync('./tests/data/google_spreadsheets_laser_cutter.json', 'utf8')
    ) as sheets_v4.Schema$Spreadsheet,
    [
      // Manually parsed data for testing
      // Note some entries were missing in the source spreadsheet so are treated as '' to match the spreadsheet behaviour.
      {
        emailProvided: 'sparky@example.com',
        memberNumberProvided: 1111,
        score: 24,
        maxScore: 24,
        percentage: 100,
        timestampEpochMS: 1601214546_000 as EpochTimestampMilliseconds,
      },
      {
        emailProvided: 'flonn@example.com',
        memberNumberProvided: 1111,
        score: 24,
        maxScore: 24,
        percentage: 100,
        timestampEpochMS: 1601298462_000 as EpochTimestampMilliseconds,
      },
    ]
  );

export const TROUBLE_TICKETS_EXAMPLE: ManualParsed<ManualParsedTroubleTicketEntry> =
  genManualParsed(
    JSON.parse(
      readFileSync(
        './tests/data/google_spreadsheets_trouble_tickets.json',
        'utf8'
      )
    ) as sheets_v4.Schema$Spreadsheet,
    [
      {
        timestampEpochMs: 1622379030000 as EpochTimestampMilliseconds,
        emailProvided: 'example@example1.com',
        whichEquipmentWereYouUsing: '3d printer (PLA)',
        ifYouAnsweredOtherAbove: '',
        whatsTheStatusOfTheMachine:
          "It's working but not adjusted/configured correctly",
        whatWereYouAttemptingToDo: 'Print a model ',
        whatErrorOrIssueDidYouEncounter:
          'The first layer z offset is set too close to the printbed',
        whatStepsDidYouTakeBeforeEncountering: 'Started my print ',
        nameProvided: 'Example Name',
        membershipNumberProvided: 1234,
      },
      {
        timestampEpochMs: 1743029221000 as EpochTimestampMilliseconds,
        emailProvided: 'example2.example2.com',
        whichEquipmentWereYouUsing: 'Metal Lathe',
        ifYouAnsweredOtherAbove: 'Testing the google form is working',
        whatsTheStatusOfTheMachine:
          "It's working but not adjusted/configured correctly, It was not found in the correct condition",
        whatWereYouAttemptingToDo: 'Test response 1',
        whatErrorOrIssueDidYouEncounter: 'Test response 2',
        whatStepsDidYouTakeBeforeEncountering: 'Test response 3',
        nameProvided: 'Example2 Name2',
        membershipNumberProvided: 9876,
      },
      {
        timestampEpochMs: 1743091734000 as EpochTimestampMilliseconds,
        emailProvided: 'example3@example3.com',
        whichEquipmentWereYouUsing: 'Embroidery Machine',
        ifYouAnsweredOtherAbove: '',
        whatsTheStatusOfTheMachine: 'Consumables need',
        whatWereYouAttemptingToDo:
          "I'm just testing the Trouble ticket automation. Ignore this ticket!",
        whatErrorOrIssueDidYouEncounter: 'Test response 2',
        whatStepsDidYouTakeBeforeEncountering: 'Test response 3',
        nameProvided: 'Example3 Name3',
        membershipNumberProvided: 6789,
      },
    ]
  );

export const getLatestEvent = (
  data: ManualParsed<ManualParsedTrainingSheetEntry>
) =>
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
export const GOOGLE_SHEETS = {
  [EMPTY.apiResp.spreadsheetId!]: EMPTY,
  [METAL_LATHE.apiResp.spreadsheetId!]: METAL_LATHE,
  [LASER_CUTTER.apiResp.spreadsheetId!]: LASER_CUTTER,
  [BAMBU.apiResp.spreadsheetId!]: BAMBU,
  [TROUBLE_TICKETS_EXAMPLE.apiResp.spreadsheetId!]: TROUBLE_TICKETS_EXAMPLE,
};
