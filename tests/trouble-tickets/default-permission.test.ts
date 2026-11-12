import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';
import {EmailAddress} from '../../src/types';
import {
  initTestFramework,
  TestFramework,
} from '../read-models/test-framework';

describe('new ticket permission', () => {
  let framework: TestFramework;
  let areaId: UUID;
  let equipmentId: UUID;
  const reporter = {
    memberNumber: 123,
    emailAddress: 'reporter@example.com' as EmailAddress,
  };
  const report = () => ({
    id: faker.string.uuid() as UUID,
    submittedEquipment: 'Committee',
    submittedMemberNumber: null,
    submittedEmail: null,
    submittedName: null,
    otherEquipmentDetail: '',
    status: '',
    attempting: '',
    issue: 'Something broke',
    steps: '',
  });

  beforeEach(async () => {
    framework = await initTestFramework();
    areaId = faker.string.uuid() as UUID;
    equipmentId = faker.string.uuid() as UUID;
    framework.depsForCommands.conf.MANAGEMENT_TEAM_AREA_ID = areaId;
    await framework.commands.area.create({
      id: areaId,
      name: 'Management' as NonEmptyString,
    });
    await framework.commands.area.addNameAlias({
      areaId,
      alias: 'Committee' as NonEmptyString,
    });
    await framework.commands.equipment.add({
      id: equipmentId,
      areaId,
      name: 'Office printer' as NonEmptyString,
    });
    await framework.commands.equipment.addNameAlias({
      equipmentId,
      alias: 'Printer' as NonEmptyString,
    });
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: reporter.memberNumber,
      email: reporter.emailAddress,
      name: undefined,
      formOfAddress: undefined,
    });
  });
  afterEach(() => framework.close());

  it('records manager visibility for manual tickets resolved through an area alias', async () => {
    await framework.commands.troubleTickets.create(report());
    expect(
      await framework.getAllEventsByType('TroubleTicketCreated')
    ).toEqual([expect.objectContaining({permission: 'manager'})]);
  });

  it('records manager visibility for imported tickets resolved through an equipment alias', async () => {
    await framework.commands.troubleTickets.record({
      ...report(),
      submittedEquipment: 'Printer',
      rowHash: faker.string.uuid() as NonEmptyString,
      sheetId: 'sheet' as NonEmptyString,
      submittedAt: new Date(),
    });
    expect(
      await framework.getAllEventsByType('TroubleTicketCreated')
    ).toEqual([expect.objectContaining({permission: 'manager'})]);
  });

  it('records manager visibility for member and public reports against management equipment', async () => {
    const problem = {
      equipmentId,
      machine: '',
      otherEquipmentDetail: '',
      machineStatuses: [],
      attempting: '',
      issue: 'Out of ink',
      steps: '',
    };
    await framework.commands.troubleTickets.raise({
      ...problem,
      actor: {tag: 'user', user: reporter},
    });
    await framework.commands.troubleTickets.raisePublic({
      ...problem,
      actor: {tag: 'public'},
      reporterName: '',
      reporterEmail: null,
      reporterMemberNumber: null,
    });
    expect(
      await framework.getAllEventsByType('TroubleTicketCreated')
    ).toEqual([
      expect.objectContaining({permission: 'manager'}),
      expect.objectContaining({permission: 'manager'}),
    ]);
  });

  it('stores an explicit creation choice instead of the area default', async () => {
    await framework.commands.troubleTickets.raise({
      equipmentId,
      machine: '',
      otherEquipmentDetail: '',
      machineStatuses: [],
      attempting: '',
      issue: 'Out of ink',
      steps: '',
      permission: 'area-owner',
      actor: {tag: 'user', user: reporter},
    });

    expect(await framework.getAllEventsByType('TroubleTicketCreated'))
      .toEqual([expect.objectContaining({permission: 'area-owner'})]);
    expect(framework.sharedReadModel.troubleTickets.getAll())
      .toEqual([expect.objectContaining({permission: 'area-owner'})]);
  });

  it('records area-owner visibility for unassigned and ordinary area tickets', async () => {
    const ordinaryArea = faker.string.uuid() as UUID;
    await framework.commands.area.create({
      id: ordinaryArea,
      name: 'Wood' as NonEmptyString,
    });
    await framework.commands.troubleTickets.create({
      ...report(),
      submittedEquipment: null,
    });
    await framework.commands.troubleTickets.create({
      ...report(),
      submittedEquipment: 'Wood',
    });
    expect(
      await framework.getAllEventsByType('TroubleTicketCreated')
    ).toEqual([
      expect.objectContaining({permission: 'area-owner'}),
      expect.objectContaining({permission: 'area-owner'}),
    ]);
  });
});
