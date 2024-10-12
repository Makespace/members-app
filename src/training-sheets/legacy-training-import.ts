import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import {parse} from 'uuid';
import {Config} from '../configuration';
import {Dependencies} from '../dependencies';
import {GoogleAuth} from 'google-auth-library';
import {pullGoogleSheetData} from '../init-dependencies/google/pull_sheet_data';
import {extractTimestamp} from './google';
import {EventOfType} from '../types/domain-event';
import {Actor} from '../types/actor';
import {inspect} from 'node:util';

type ImportDeps = Pick<
  Dependencies,
  'logger' | 'getAllEventsByType' | 'commitEvent'
>;

// Temporary import script.
export const legacyTrainingImport = async (conf: Config, deps: ImportDeps) => {
  // Ontime legacy import.
  deps.logger.info('Checking if we need to do legacy training import');
  if (!conf.LEGACY_TRAINING_COMPLETE_SHEET) {
    deps.logger.info(
      "Legacy training complete sheet isn't set. Don't need to do legacy import"
    );
    return;
  }
  // Check if we have already done the legacy import.
  const prevEvents = await deps.getAllEventsByType(
    'MemberTrainedOnEquipment'
  )();
  if (E.isLeft(prevEvents)) {
    deps.logger.warn(
      'Failed to get previous events to decide if legacy training import required, skipping'
    );
    deps.logger.warn(prevEvents.left);
    return;
  }
  // const alreadyLegacyImported = pipe(
  //   prevEvents.right,
  //   RA.filter(e => e.legacyImport),
  //   RA.isNonEmpty
  // );
  // if (alreadyLegacyImported) {
  //   deps.logger.info('Already completed legacy import');
  //   return;
  // }

  const googleAuth = new GoogleAuth({
    // Google issues the credentials file and validates it.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    credentials: JSON.parse(conf.GOOGLE_SERVICE_ACCOUNT_KEY_JSON),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheetData = await pullGoogleSheetData(googleAuth)(
    deps.logger,
    conf.LEGACY_TRAINING_COMPLETE_SHEET,
    'Form responses 1',
    2, // Rows start at 1, row 2 is column headers.
    // 2000,
    2050,
    0,
    8
  )();
  if (E.isLeft(sheetData)) {
    deps.logger.warn('Failed to get legacy sheet data for import, skipping');
    deps.logger.warn(sheetData.left);
    return;
  }

  const parsedData = [];

  for (const row of sheetData.right.sheets[0].data[0].rowData) {
    // I know the sheet schema so I know exactly what columns to use.
    if (row.values.length < 9) {
      deps.logger.warn('Failed to parse row as missing columns');
      deps.logger.warn(row.values);
      continue;
    }
    parsedData.push({
      timestamp: extractTimestamp('Europe/London')(
        O.fromNullable(row.values[0].formattedValue)
      ),
      trainer_number: tt.IntFromString.decode(row.values[3].formattedValue),
      equipment_name: t.string.decode(row.values[4].formattedValue),
      trainee_number: tt.IntFromString.decode(row.values[6].formattedValue),
      passed: t.string.decode(row.values[8].formattedValue),
      raw: row,
    });
  }

  const newEvents: EventOfType<'MemberTrainedOnEquipment'>[] = [];

  const equipmentNameIdMap: Record<string, string> = {
    'Bambu X1': 'be613ddb-f959-4c07-9dab-a714c1d9dcfd',
    Bambu_x1: 'be613ddb-f959-4c07-9dab-a714c1d9dcfd',

    Ultimakers: '075f535b-a519-4aaf-84cf-f8b547008bd3',
    '3D_Printer': '075f535b-a519-4aaf-84cf-f8b547008bd3',

    'Markforged Mark II': 'dccca823-4a09-4f65-8ca5-b4bbbd3a118b',
    Markforged_Mark_2: 'dccca823-4a09-4f65-8ca5-b4bbbd3a118b',

    'Form 3 Resin Printer': '2a96f797-4e3b-4778-9eb8-bf7cd600edd6',

    'Domino Joiner': '22aeae84-31ad-4a60-ab5b-c973ddf5d4a3',
    Domino_Joiner: '22aeae84-31ad-4a60-ab5b-c973ddf5d4a3',

    'Band Saw': '4fda0066-5c6f-4043-9b2e-4ca1fda44057',
    Band_Saw: '4fda0066-5c6f-4043-9b2e-4ca1fda44057',

    Plunge_Router: 'f857639d-78dd-49eb-81db-33b48a9092fe',
    'Festool OF1010 Router': 'f857639d-78dd-49eb-81db-33b48a9092fe',

    'Mitre Saw': '6ff03684-04b6-4d10-9df8-7020b0955fb6',

    'Planer Thicknesser': 'ea9f1ed0-1044-4cbe-b58d-12bc2416acec',
    'Planer/Thicknesser  Hammer A3-31': 'ea9f1ed0-1044-4cbe-b58d-12bc2416acec',

    'Circular_Hand Saw': 'a33d672e-c433-4a82-a322-ceba1fa72d47',
    'Plunge Saw  Festool TS75': 'a33d672e-c433-4a82-a322-ceba1fa72d47',
    Plunge_Saw: 'a33d672e-c433-4a82-a322-ceba1fa72d47',

    Tormek: 'de26bff7-a0e3-4fcb-809d-abebaaea3a07',

    Thickneser: '794a7ba7-3e93-4558-8087-df7816a5984a',
    Thicknesser: '794a7ba7-3e93-4558-8087-df7816a5984a',

    'HPC Laser Cutter': 'dbc3d9b6-4152-413d-8768-835a5d3d9d2e',
    Laser_Cutter: 'dbc3d9b6-4152-413d-8768-835a5d3d9d2e',

    Trotec: '7fb37d96-56f2-4ffa-a213-135f0e5bd0ba',
    Laser_Cutter_Trotec: '7fb37d96-56f2-4ffa-a213-135f0e5bd0ba',

    'CNC Router': '44295217-416c-436e-a7ed-c4ff2d3e0bd5',
    CNC_Router: '44295217-416c-436e-a7ed-c4ff2d3e0bd5',

    CNC_Model_Mill: '38137289-f97b-4c9c-8aed-00e2b82f8d9a',
    'CNC Model Mill': '38137289-f97b-4c9c-8aed-00e2b82f8d9a',

    'Embroidery Machine': '1178c538-04b0-4ef9-8419-34e73f90648d',

    'Pfaff 591 industrial sewing machine':
      '0f2dd455-096d-418e-9508-dd2c880a7ed3',
    'pfaff-591-industrial-sewing-machine':
      '0f2dd455-096d-418e-9508-dd2c880a7ed3',

    'Metal Mill': 'b0dc0a6d-e342-4be7-a9c7-2cc21615a705',
    Metal_Mill: 'b0dc0a6d-e342-4be7-a9c7-2cc21615a705',

    'Metal Lathe': '079bba13-2f32-4b31-9da1-e8c5f030b958',
    'Tool Grinder': 'c351ba85-2514-413e-8257-63c1d846ddd3',
    'Metal Casting': '1c5db356-7c6d-4500-a815-4af005b76f85',
    'Electrical Working Policy': '8aea8e2f-acb9-4b31-9c1a-7f34c16e5ce0',
    'Fine Metals Bench': 'd053cd2c-1ba3-483c-bdb9-338b14ffc753',

    'Glass Working Kiln': '26a9f079-5a86-4014-85af-15dfebdf73ea',
    'Kiln_&_Glass_Bead': '3c6b1a58-472d-4f46-9c98-0301f64b97a9',

    Wood_Lathe: '72a373b3-cb24-4797-8ba4-5b007e0a45d0',

    'Bio Labs Safety Training Part I - General':
      '8e66ecc7-4765-424a-8e71-75d19a2345f0',
    'Bio Labs Safety Training Part II - Working':
      '593e396d-dfb3-4339-bb10-3660fa5df4c3',
    BioLabs_Autoclave: 'cadb1006-2262-44ab-b270-946c2946aafc',
    Biological_Safety_Cabinet: 'f572f93f-f8c1-489c-9065-fb5a5fac5a26',

    'Woodworking Handtools': 'b4d82654-05b4-4f7e-ae59-88ff8734fd98',
  };

  for (const parsedRow of parsedData) {
    if (
      E.isLeft(parsedRow.trainee_number) ||
      parsedRow.trainee_number.right <= 0 ||
      parsedRow.trainee_number.right > 2000
    ) {
      deps.logger.warn('Failed to parse legacy row trainee number');
      deps.logger.warn(parsedRow);
      continue;
    }

    if (
      E.isLeft(parsedRow.trainer_number) ||
      parsedRow.trainer_number.right <= 0 ||
      parsedRow.trainer_number.right > 2000
    ) {
      deps.logger.warn('Failed to parse legacy row trainer number');
      deps.logger.warn(parsedRow);
      continue;
    }

    if (E.isLeft(parsedRow.passed)) {
      deps.logger.warn('Failed to parse legacy row passed');
      deps.logger.warn(parsedRow);
      continue;
    }

    if (E.isLeft(parsedRow.timestamp)) {
      deps.logger.warn('Failed to parse legacy row timestamp');
      deps.logger.warn(parsedRow);
      continue;
    }

    if (E.isLeft(parsedRow.equipment_name)) {
      deps.logger.warn('Failed to parse legacy row equipment name');
      deps.logger.warn(parsedRow);
      continue;
    }

    const equipmentId = O.fromNullable(
      equipmentNameIdMap[parsedRow.equipment_name.right]
    );
    if (O.isNone(equipmentId)) {
      deps.logger.warn(
        'Failed to find equipment id for equipment name: %s',
        parsedRow.equipment_name.right
      );
      deps.logger.warn(parsedRow);
      continue;
    }

    if (!parsedRow.passed.right) {
      deps.logger.warn('Legacy row not passed');
      deps.logger.warn(parsedRow);
      continue;
    }

    // Magic numbers from me manually checking the spreadsheet.
    if (
      parsedRow.timestamp.right < 1601588298000 ||
      parsedRow.timestamp.right > 1728735321000
    ) {
      deps.logger.warn('Failed to parse legacy row timestamp - out of range');
      deps.logger.warn(parsedRow.timestamp.right);
      deps.logger.warn(parsedRow);
      continue;
    }
    parse(equipmentId.value);
    newEvents.push({
      type: 'MemberTrainedOnEquipment',
      legacyImport: true,
      memberNumber: parsedRow.trainee_number.right,
      trainedByMemberNumber: parsedRow.trainer_number.right,
      equipmentId: equipmentId.value as tt.UUID,
      actor: {tag: 'system'} satisfies Actor,
      recordedAt: new Date(parsedRow.timestamp.right),
    });
  }

  deps.logger.info(
    'Successful events: %s out of %s rows',
    newEvents.length,
    sheetData.right.sheets[0].data[0].rowData.length
  );
  let successfully_committed = 0;
  for (const newEvent of newEvents) {
    const resourceId = `${newEvent.equipmentId}_${newEvent.memberNumber}_${newEvent.recordedAt.toISOString()}`;
    const res = await deps.commitEvent(
      {
        type: 'LegacyMemberTrainedOnEquipment',
        id: resourceId, // Intentionally fudge the versioning control for this 1-off import.
      },
      'no-such-resource'
    )(newEvent)();
    if (E.isLeft(res)) {
      deps.logger.warn(
        `Legacy import commit failure (skipped): resource_id: ${resourceId}, ${inspect(res.left)}`
      );
    } else {
      successfully_committed++;
    }
  }
  deps.logger.info(
    'Successful legacy events committed: %s',
    successfully_committed
  );
};
