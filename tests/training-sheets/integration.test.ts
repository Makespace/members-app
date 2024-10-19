/**
 * Actually connects to google and pulls spreadsheet data.
 *
 * Only runs when triggered manually.
 */

import pino from 'pino';
import {pullNewEquipmentQuizResults} from '../../src/read-models/shared-state/async-apply-external-event-sources';
import {
  pullGoogleSheetData,
  pullGoogleSheetDataMetadata,
} from '../../src/init-dependencies/google/pull_sheet_data';
import {GoogleAuth} from 'google-auth-library/build/src/auth/googleauth';
import {UUID} from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as RA from 'fp-ts/ReadonlyArray';
import {DomainEvent} from '../../src/types';
import {pipe} from 'fp-ts/lib/function';
import {getSomeOrFail} from '../helpers';

const CREDENTIALS_PATH = '../test-google/credentials.json.ignore';

const TEST_USER = 1741;

const getEvents = async (trainingSheetId: string) => {
  const auth = new GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const events: DomainEvent[] = [];
  await pullNewEquipmentQuizResults(
    pino(),
    {
      pullGoogleSheetData: pullGoogleSheetData(auth),
      pullGoogleSheetDataMetadata: pullGoogleSheetDataMetadata(auth),
    },
    {
      id: 'a008b6f2-3338-4339-a846-3b4f3d12fe3d' as UUID,
      name: 'Test Equipment',
      trainingSheetId: O.some(trainingSheetId),
      lastQuizResult: O.none,
      lastQuizSync: O.none,
    },
    event => events.push(event)
  );
  return events;
};

describe.skip('Google training sheet integration', () => {
  it.skip('Form 3 Resin Printer', async () => {
    const events = await getEvents(
      '1rnG8qvYXL5CucsS7swr9ajGYvHndBG1TKIbyG3KioHc'
    );
    const userEvent = getSomeOrFail(
      pipe(
        events,
        RA.findFirst(
          event =>
            event.type === 'EquipmentTrainingQuizResult' &&
            event.memberNumberProvided === TEST_USER &&
            event.score === event.maxScore &&
            event.percentage === 100
        )
      )
    );
    if (userEvent.type !== 'EquipmentTrainingQuizResult') {
      throw new Error();
    }
    expect(userEvent.timestampEpochMS).toStrictEqual(1726008048000);
  });

  // it('Metal Lathe', async () => {
  //   const events = await getEvents(
  //     '1Yu8TeG9RTqSEu3dxL5wj8uXfeP3xbIgxQZ1ZB9kyFUE'
  //   );
  //   expect(
  //     O.isSome(
  //       pipe(
  //         events,
  //         RA.findFirst(
  //           event =>
  //             event.type === 'EquipmentTrainingQuizResult' &&
  //             event.memberNumberProvided === TEST_USER &&
  //             event.score === event.maxScore &&
  //             event.percentage === 100
  //         )
  //       )
  //     )
  //   );
  // });
  // it.skip('3D_Printer', async () => {
  //   const _events = await getEvents(
  //     '1jqzbGuf5m2_cTO3VQv4W5lTurNUeBt0SUMEIPMmhWi0'
  //   );
  // });
  // it.skip('Markforged_Mark_2', async () => {
  //   const _events = await getEvents(
  //     '15Ed7mkMud74UV0bNu2jKB8W1MrH_8pUeNIGdrtZqCoo'
  //   );
  // });
  // it.skip('Domino_Joiner', async () => {
  //   const _events = await getEvents(
  //     '1tWznV2GQls1a6sopw_lm7Iy58kM3kOCVtG2VDKL6SD4'
  //   );
  // });
  // it.skip('CNC_Router', async () => {
  //   const _events = await getEvents(
  //     '1af3nNXVXjYMTuH6F9vAg2CKRIewU3M8-nhUjiRIf8Q0'
  //   );
  // });
  // it.skip('Band_Saw', async () => {
  //   const _events = await getEvents(
  //     '11S81Gb-QyFNaI_-RH3Xcrwqtyfd47z7l-lXUAB9SzEY'
  //   );
  // });
  // it.skip('Mitre Saw', async () => {
  //   const _events = await getEvents(
  //     '1e9Vgxuh7k01QNrrxGiF6jGUkbFcRK8S2if1FINbCWwY'
  //   );
  // });
  // it.skip('Tormek', async () => {
  //   const _events = await getEvents(
  //     '1_40_3xSjgDgLBiccQ7N2KNQvPIo51oPOYkvHo3aF3mY'
  //   );
  // });
  // it.skip('Laser_Cutter', async () => {
  //   const _events = await getEvents(
  //     '1481VwMyXeqZDZBkgxn8O-R0oM4mt4mbkN2wzmSNvvBs'
  //   );
  // });
  // it.skip('Wood_Lathe', async () => {
  //   const _events = await getEvents(
  //     '1fyEWGyGOYTvMmlMdl58nErFDjubVQBXNRsmQb1td3_c'
  //   );
  // });
  // it.skip('Plunge_Saw', async () => {
  //   const _events = await getEvents(
  //     '1fGw4IdAJoGOGZ3hsOo_wEQB0KIQA1PRFDW6XfgY-xmQ'
  //   );
  // });
  // it.skip('CNC_Model_Mill', async () => {
  //   const _events = await getEvents(
  //     '1pIhiQY9B1J_kB6azrACeSed1XdGyHPt8z_TLcD-EEQs'
  //   );
  // });
  // it.skip('Plunge_Router', async () => {
  //   const _events = await getEvents(
  //     '1G0mvZTuVrvL7GR92wbr15YtRdsDR1IpZFta8AtIJL5I'
  //   );
  // });
  // it.skip('Festool OF1010 Router', async () => {
  //   const _events = await getEvents(
  //     '16CvHlJlUt2bOkITgnFd2gwbLN0weTV1u7CuOb2bhyxk'
  //   );
  // });
  // it.skip('Embroidery Machine', async () => {
  //   const _events = await getEvents(
  //     '1Krto0mc2clINQJrM8ZJJh0P5hISjt1C3vnK2xQaBATM'
  //   );
  // });
  // it.skip('Planer Thicknesser', async () => {
  //   const _events = await getEvents(
  //     '1TVuM9GtSyE8Cq3_p3R3GZOmZE47Au-gSM1B9vXl2JOA'
  //   );
  // });
  // it.skip('Woodworking Handtools', async () => {
  //   const _events = await getEvents(
  //     '1CD_Va0th0dJmOSCjVGVCimrzkN7gKGjmMhifv7S9hY0'
  //   );
  // });
  // it.skip('Metal_Mill', async () => {
  //   const _events = await getEvents(
  //     '1yulN3ewYS2XpT22joP5HteZ9H9qebvSEcFXQhxPwXlk'
  //   );
  // });
  // it.skip('Bambu', async () => {
  //   const _events = await getEvents(
  //     '1i1vJmCO8_Dkpbv-izOSkffoAeJTNrJsmAV5hD0w2ADw'
  //   );
  // });
});
