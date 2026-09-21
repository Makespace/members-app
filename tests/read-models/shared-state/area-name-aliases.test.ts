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

describe('area name aliases', () => {
  let framework: TestFramework;
  const areaId = faker.string.uuid() as UUID;
  const equipmentId = faker.string.uuid() as UUID;

  beforeEach(async () => {
    framework = await initTestFramework();
    await framework.commands.area.create({
      id: areaId,
      name: 'IT Systems' as NonEmptyString,
    });
    await framework.commands.equipment.add({
      id: equipmentId,
      name: 'Parrot Server' as NonEmptyString,
      areaId,
    });
  });

  afterEach(() => {
    framework.close();
  });

  it('resolves a ticket directly to an area whose name matches', async () => {
    await framework.commands.troubleTickets.record(
      arbitraryTicket('IT Systems')
    );

    const [ticket] = framework.sharedReadModel.troubleTickets.getAll();
    expect(ticket.equipmentId).toBeNull();
    expect(ticket.areaId).toStrictEqual(areaId);
  });

  it('re-binds fully-unresolved tickets when an area alias is added', async () => {
    await framework.commands.troubleTickets.record(
      arbitraryTicket('Wi-Fi / Computers / Printer')
    );
    expect(
      framework.sharedReadModel.troubleTickets.getAll()[0].areaId
    ).toBeNull();

    await framework.commands.area.addNameAlias({
      areaId,
      alias: 'Wi-Fi / Computers / Printer' as NonEmptyString,
    });

    const [ticket] = framework.sharedReadModel.troubleTickets.getAll();
    expect(ticket.areaId).toStrictEqual(areaId);
    expect(ticket.equipmentId).toBeNull();
  });

  it('prefers specific equipment over an area with the same label', async () => {
    await framework.commands.area.addNameAlias({
      areaId,
      alias: 'Parrot Server' as NonEmptyString,
    });

    await framework.commands.troubleTickets.record(
      arbitraryTicket('Parrot Server')
    );

    const [ticket] = framework.sharedReadModel.troubleTickets.getAll();
    expect(ticket.equipmentId).toStrictEqual(equipmentId);
    expect(ticket.areaId).toBeNull();
  });

  it('an equipment alias later upgrades an area-mapped ticket', async () => {
    await framework.commands.area.addNameAlias({
      areaId,
      alias: 'The Server' as NonEmptyString,
    });
    await framework.commands.troubleTickets.record(
      arbitraryTicket('The Server')
    );
    expect(
      framework.sharedReadModel.troubleTickets.getAll()[0].areaId
    ).toStrictEqual(areaId);

    await framework.commands.equipment.addNameAlias({
      equipmentId,
      alias: 'The Server' as NonEmptyString,
    });

    const [ticket] = framework.sharedReadModel.troubleTickets.getAll();
    expect(ticket.equipmentId).toStrictEqual(equipmentId);
  });
});
