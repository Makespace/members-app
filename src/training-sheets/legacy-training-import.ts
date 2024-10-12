import {pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import * as RA from 'fp-ts/ReadonlyArray';
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

export type ImportDeps = Pick<
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
  const alreadyLegacyImported = pipe(
    prevEvents.right,
    RA.filter(e => e.legacyImport),
    RA.isNonEmpty
  );
  if (alreadyLegacyImported) {
    deps.logger.info('Already completed legacy import');
    return;
  }

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
    1,
    // 2000,
    100,
    0,
    11
  )();
  if (E.isLeft(sheetData)) {
    deps.logger.warn('Failed to get legacy sheet data for import, skipping');
    deps.logger.warn(sheetData.left);
    return;
  }

  const parsedData = [];

  for (const row of sheetData.right.sheets[0].data[0].rowData) {
    // I know the sheet schema so I know exactly what columns to use.
    parsedData.push({
      timestamp: extractTimestamp('Europe/London')(
        O.fromNullable(row.values[0].formattedValue)
      ),
      trainer_number: tt.IntFromString.decode(row.values[3].formattedValue),
      equipment_name: t.string.decode(row.values[4]),
      trainee_number: tt.IntFromString.decode(row.values[6]),
      passed: t.string.decode(row.values[8]),
      raw: row,
    });
  }

  const newEvents: EventOfType<'MemberTrainedOnEquipment'>[] = [];

  const equipmentNameIdMap: Record<string, string> = {
    'Bambu X1': 'be613ddb-f959-4c07-9dab-a714c1d9dcfd',
    Ultimakers: '075f535b-a519-4aaf-84cf-f8b547008bd3',
    'Markforged Mark II': 'dccca823-4a09-4f65-8ca5-b4bbbd3a118b',
    'Form 3 Resin Printer': '2a96f797-4e3b-4778-9eb8-bf7cd600edd6',
    'Domino Joiner': '22aeae84-31ad-4a60-ab5b-c973ddf5d4a3',
    'Band Saw': '4fda0066-5c6f-4043-9b2e-4ca1fda44057',
    'Festool OF1010 Router': 'f857639d-78dd-49eb-81db-33b48a9092fe',
    'Mitre Saw': '6ff03684-04b6-4d10-9df8-7020b0955fb6',
    'Planer/Thicknesser  Hammer A3-31': 'ea9f1ed0-1044-4cbe-b58d-12bc2416acec',
    'Plunge Saw  Festool TS75': 'a33d672e-c433-4a82-a322-ceba1fa72d47',
    Tormek: 'de26bff7-a0e3-4fcb-809d-abebaaea3a07',
    Thicknesser: '794a7ba7-3e93-4558-8087-df7816a5984a',
    'HPC Laser Cutter': 'dbc3d9b6-4152-413d-8768-835a5d3d9d2e',
    Trotec: '7fb37d96-56f2-4ffa-a213-135f0e5bd0ba',
    'CNC Router': '44295217-416c-436e-a7ed-c4ff2d3e0bd5',
    'CNC Model Mill': '38137289-f97b-4c9c-8aed-00e2b82f8d9a',
    'Embroidery Machine': '1178c538-04b0-4ef9-8419-34e73f90648d',
    'Pfaff 591 industrial sewing machine':
      '0f2dd455-096d-418e-9508-dd2c880a7ed3',
    'Metal Mill': 'b0dc0a6d-e342-4be7-a9c7-2cc21615a705',
    'Metal Lathe': '079bba13-2f32-4b31-9da1-e8c5f030b958',
    'Tool Grinder': 'c351ba85-2514-413e-8257-63c1d846ddd3',
    'Metal Casting': '1c5db356-7c6d-4500-a815-4af005b76f85',
    'Electrical Working Policy': '8aea8e2f-acb9-4b31-9c1a-7f34c16e5ce0',
    'Fine Metals Bench': 'd053cd2c-1ba3-483c-bdb9-338b14ffc753',
    'Glass Working Kiln': '26a9f079-5a86-4014-85af-15dfebdf73ea',
  };

  for (const parsedRow of parsedData) {
    if (E.isLeft(parsedRow.trainee_number)) {
      deps.logger.warn('Failed to parse legacy row trainee number');
      deps.logger.warn(parsedRow.raw);
      continue;
    }

    if (E.isLeft(parsedRow.trainer_number)) {
      deps.logger.warn('Failed to parse legacy row trainer number');
      deps.logger.warn(parsedRow.raw);
      continue;
    }

    if (E.isLeft(parsedRow.passed)) {
      deps.logger.warn('Failed to parse legacy row passed');
      deps.logger.warn(parsedRow.raw);
      continue;
    }

    if (E.isLeft(parsedRow.timestamp)) {
      deps.logger.warn('Failed to parse legacy row timestamp');
      deps.logger.warn(parsedRow.raw);
      continue;
    }

    if (E.isLeft(parsedRow.equipment_name)) {
      deps.logger.warn('Failed to parse legacy row equipment name');
      deps.logger.warn(parsedRow.raw);
      continue;
    }

    const equipmentId = O.fromNullable(
      equipmentNameIdMap[parsedRow.equipment_name.right]
    );
    if (O.isNone(equipmentId)) {
      deps.logger.warn(
        'Failed to find equipment id for equipment name: {}',
        parsedRow.equipment_name.right
      );
      deps.logger.warn(parsedRow.raw);
      continue;
    }

    if (!parsedRow.passed.right) {
      deps.logger.warn('Legacy row not passed');
      deps.logger.warn(parsedRow.raw);
      continue;
    }

    // Magic numbers from me manually checking the spreadsheet.
    if (
      parsedRow.timestamp.right < 1601591897000 ||
      parsedRow.timestamp.right > 1728735321000
    ) {
      deps.logger.warn('Failed to parse legacy row timestamp - out of range');
      deps.logger.warn(parsedRow.timestamp.right);
      deps.logger.warn(parsedRow.raw);
      continue;
    }
    newEvents.push({
      type: 'MemberTrainedOnEquipment',
      legacyImport: true,
      memberNumber: parsedRow.trainee_number.right,
      trainedByMemberNumber: parsedRow.trainer_number.right,
      equipmentId: parse(equipmentId.value).toString() as tt.UUID,
      actor: {tag: 'system'} satisfies Actor,
      recordedAt: new Date(parsedRow.timestamp.right),
    });
  }

  deps.logger.info('Successful events:');
  for (const newEvent of newEvents) {
    deps.logger.info(newEvent);
  }
};
