import * as O from 'fp-ts/Option';
import * as T from 'fp-ts/Task';
import {pipe} from 'fp-ts/lib/function';
import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';
import {constructViewModel} from '../../../src/queries/trouble-tickets-home/construct-view-model';
import {getRightOrFail} from '../../helpers';
import {TestFramework, initTestFramework} from '../../read-models/test-framework';
import {EmailAddress} from '../../../src/types';

const MEMBER = 501;

describe('the trouble tickets landing page, pointed at one thing', () => {
  let framework: TestFramework;
  let woodAreaId: UUID;
  let laserAreaId: UUID;
  let bandsawId: UUID;
  const user = {
    memberNumber: MEMBER,
    emailAddress: 'member@example.com' as EmailAddress,
  };

  const ticket = (equipmentName: string) => ({
    id: faker.string.uuid() as UUID,
    rowHash: faker.string.hexadecimal({length: 64}) as NonEmptyString,
    sheetId: 'sheet-1' as NonEmptyString,
    submittedAt: new Date(),
    submittedMemberNumber: null,
    submittedEmail: 'someone@example.com',
    submittedName: 'Someone',
    submittedEquipment: equipmentName,
    otherEquipmentDetail: '',
    status: 'Broken',
    attempting: 'x',
    issue: `${equipmentName} is broken`,
    steps: '',
  });

  beforeEach(async () => {
    framework = await initTestFramework();
    woodAreaId = faker.string.uuid() as UUID;
    laserAreaId = faker.string.uuid() as UUID;
    bandsawId = faker.string.uuid() as UUID;

    await framework.commands.area.create({
      id: woodAreaId,
      name: 'Wood Shop' as NonEmptyString,
    });
    await framework.commands.area.create({
      id: laserAreaId,
      name: 'Laser Area' as NonEmptyString,
    });
    await framework.commands.equipment.add({
      id: bandsawId,
      name: 'Band Saw' as NonEmptyString,
      areaId: woodAreaId,
    });
    await framework.commands.equipment.add({
      id: faker.string.uuid() as UUID,
      name: 'Trotec' as NonEmptyString,
      areaId: laserAreaId,
    });
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: MEMBER,
      email: 'member@example.com' as EmailAddress,
      name: undefined,
      formOfAddress: undefined,
    });

    await framework.commands.troubleTickets.record(ticket('Band Saw'));
    await framework.commands.troubleTickets.record(ticket('Band Saw'));
    await framework.commands.troubleTickets.record(ticket('Trotec'));
  });

  afterEach(() => {
    framework.close();
  });

  const view = (params: {equipmentId?: string; areaId?: string}) =>
    pipe(
      user,
      constructViewModel(framework.depsForCommands, params),
      T.map(getRightOrFail)
    )();

  it('counts everything when pointed at nothing', async () => {
    expect((await view({})).active).toBe(3);
  });

  it('counts only the machine it is pointed at', async () => {
    const board = await view({equipmentId: bandsawId});

    expect(board.active).toBe(2);
    expect(board.focus).toStrictEqual(
      O.some(
        expect.objectContaining({kind: 'equipment', name: 'Band Saw'})
      )
    );
  });

  it('says where the machine is, so the page reads as being about it', async () => {
    const board = await view({equipmentId: bandsawId});

    expect(
      pipe(
        board.focus,
        O.chain(focus => focus.areaName)
      )
    ).toStrictEqual(O.some('Wood Shop'));
  });

  it('counts every machine in the area it is pointed at', async () => {
    const board = await view({areaId: woodAreaId});

    expect(board.active).toBe(2);
    expect(board.focus).toStrictEqual(
      O.some(expect.objectContaining({kind: 'area', name: 'Wood Shop'}))
    );
  });

  // A QR code can outlive the thing it names; reporting a problem still has
  // to work, so an unknown id falls back to the whole of Makespace.
  it('ignores an id it does not recognise', async () => {
    const board = await view({equipmentId: faker.string.uuid()});

    expect(board.focus).toStrictEqual(O.none);
    expect(board.active).toBe(3);
  });

  it('prefers the machine when given both', async () => {
    const board = await view({equipmentId: bandsawId, areaId: laserAreaId});

    expect(board.focus).toStrictEqual(
      O.some(expect.objectContaining({kind: 'equipment'}))
    );
  });
});
