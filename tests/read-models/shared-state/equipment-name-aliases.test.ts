import {faker} from '@faker-js/faker';
import {Int} from 'io-ts';
import {NonEmptyString, UUID} from 'io-ts-types';
import {TestFramework, initTestFramework} from '../test-framework';

const arbitraryTicket = (submittedEquipment: string | null) => ({
  id: faker.string.uuid() as UUID,
  rowHash: faker.string.alphanumeric(64) as NonEmptyString,
  sheetId: faker.string.alphanumeric(10) as NonEmptyString,
  submittedAt: faker.date.past(),
  submittedMemberNumber: faker.number.int({min: 1}) as Int,
  submittedEmail: null,
  submittedName: null,
  submittedEquipment,
  otherEquipmentDetail: '',
  status: 'Down',
  attempting: '',
  issue: faker.lorem.sentence(),
  steps: '',
});

describe('equipment name aliases', () => {
  let framework: TestFramework;
  const areaId = faker.string.uuid() as UUID;
  const hpcId = faker.string.uuid() as UUID;
  const trotecId = faker.string.uuid() as UUID;

  beforeEach(async () => {
    framework = await initTestFramework();
    await framework.commands.area.create({
      id: areaId,
      name: 'Laser Cutters' as NonEmptyString,
    });
    await framework.commands.equipment.add({
      id: hpcId,
      name: 'HPC Laser Cutter' as NonEmptyString,
      areaId,
    });
    await framework.commands.equipment.add({
      id: trotecId,
      name: 'Trotec' as NonEmptyString,
      areaId,
    });
  });

  afterEach(() => {
    framework.close();
  });

  it('re-binds Unassigned tickets whose form string matches a new alias', async () => {
    await framework.commands.troubleTickets.record(
      arbitraryTicket('Laser cutter (Jaws)')
    );
    expect(
      framework.sharedReadModel.troubleTickets.getAll()[0].equipmentId
    ).toBeNull();

    await framework.commands.equipment.addNameAlias({
      equipmentId: hpcId,
      alias: 'Laser cutter (Jaws)' as NonEmptyString,
    });

    expect(
      framework.sharedReadModel.troubleTickets.getAll()[0].equipmentId
    ).toStrictEqual(hpcId);
  });

  it('resolves future tickets through the alias, case-insensitively', async () => {
    await framework.commands.equipment.addNameAlias({
      equipmentId: hpcId,
      alias: 'Laser cutter (Jaws)' as NonEmptyString,
    });

    await framework.commands.troubleTickets.record(
      arbitraryTicket('  laser CUTTER (jaws) ')
    );

    expect(
      framework.sharedReadModel.troubleTickets.getAll()[0].equipmentId
    ).toStrictEqual(hpcId);
  });

  it('never overrides a ticket that already has equipment', async () => {
    const ticket = arbitraryTicket('Trotec');
    await framework.commands.troubleTickets.record(ticket);
    expect(
      framework.sharedReadModel.troubleTickets.getAll()[0].equipmentId
    ).toStrictEqual(trotecId);

    await framework.commands.equipment.addNameAlias({
      equipmentId: hpcId,
      alias: 'Trotec' as NonEmptyString,
    });

    expect(
      framework.sharedReadModel.troubleTickets.getAll()[0].equipmentId
    ).toStrictEqual(trotecId);
  });

  it('re-adding an alias re-points it (mapping correction)', async () => {
    await framework.commands.equipment.addNameAlias({
      equipmentId: hpcId,
      alias: 'Glamdring' as NonEmptyString,
    });
    await framework.commands.equipment.addNameAlias({
      equipmentId: trotecId,
      alias: 'Glamdring' as NonEmptyString,
    });

    await framework.commands.troubleTickets.record(
      arbitraryTicket('Glamdring')
    );

    expect(
      framework.sharedReadModel.troubleTickets.getAll()[0].equipmentId
    ).toStrictEqual(trotecId);
  });

  it('stops resolving through a removed alias; bound tickets keep their equipment', async () => {
    await framework.commands.equipment.addNameAlias({
      equipmentId: hpcId,
      alias: 'Jaws' as NonEmptyString,
    });
    await framework.commands.troubleTickets.record(arbitraryTicket('Jaws'));

    await framework.commands.equipment.removeNameAlias({
      equipmentId: hpcId,
      alias: 'Jaws' as NonEmptyString,
    });
    await framework.commands.troubleTickets.record(arbitraryTicket('Jaws'));

    const tickets = framework.sharedReadModel.troubleTickets.getAll();
    const bound = tickets.filter(t => t.equipmentId !== null);
    const unbound = tickets.filter(t => t.equipmentId === null);
    expect(bound).toHaveLength(1);
    expect(unbound).toHaveLength(1);
  });
});
