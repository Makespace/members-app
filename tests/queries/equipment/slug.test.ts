import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';
import {StatusCodes} from 'http-status-codes';
import * as E from 'fp-ts/Either';
import {equipment} from '../../../src/queries/equipment';
import {arbitraryUser} from '../../types/user.helper';
import {getLeftOrFail, getRightOrFail} from '../../helpers';
import {
  TestFramework,
  initTestFramework,
} from '../../read-models/test-framework';

// A sign prints this page's address for someone to type, so it has to answer
// to the readable slug as well as to the uuid it was always addressed by.
describe('/equipment addressed by slug', () => {
  let framework: TestFramework;
  const areaId = faker.string.uuid() as UUID;
  const equipmentId = faker.string.uuid() as UUID;
  const user = arbitraryUser();

  const ask = (reference: string) =>
    equipment(framework.depsForCommands)(user, {equipment: reference}, {})();

  beforeEach(async () => {
    framework = await initTestFramework();
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: user.memberNumber,
      email: user.emailAddress,
      name: undefined,
      formOfAddress: undefined,
    });
    await framework.commands.area.create({
      id: areaId,
      name: 'Wood Shop' as NonEmptyString,
    });
    await framework.commands.equipment.add({
      id: equipmentId,
      name: 'Band Saw' as NonEmptyString,
      areaId,
    });
  });

  afterEach(() => {
    framework.close();
  });

  it('finds the machine by its area-and-name slug', async () => {
    const page = getRightOrFail(await ask('wood-shop-band-saw'));

    expect(JSON.stringify(page)).toContain('Band Saw');
  });

  it('is case-insensitive, since a printed address may be typed in capitals', async () => {
    expect(E.isRight(await ask('WOOD-SHOP-BAND-SAW'))).toBe(true);
  });

  it('still answers to the uuid, so links already sent out keep working', async () => {
    expect(E.isRight(await ask(equipmentId))).toBe(true);
  });

  it('reports a slug that matches nothing as not found, not as a bad request', async () => {
    expect(getLeftOrFail(await ask('wood-shop-mystery-machine')).status).toBe(
      StatusCodes.NOT_FOUND
    );
  });
});
