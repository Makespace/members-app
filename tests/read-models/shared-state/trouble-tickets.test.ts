import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';
import {constructEvent} from '../../../src/types';
import {EventOfType} from '../../../src/types/domain-event';
import {getSomeOrFail, systemActor} from '../../helpers';
import {TestFramework, initTestFramework} from '../test-framework';

const arbitraryTroubleTicketCreated = (
  overrides: Partial<EventOfType<'TroubleTicketCreated'>> = {}
): EventOfType<'TroubleTicketCreated'> =>
  constructEvent('TroubleTicketCreated')({
    actor: systemActor(),
    id: faker.string.uuid() as UUID,
    rowHash: faker.string.hexadecimal({length: 64}),
    sheetId: 'sheet-1',
    submittedAt: faker.date.past(),
    submittedMemberNumber: faker.number.int({min: 1, max: 9999}),
    submittedEmail: faker.internet.email(),
    submittedName: faker.person.fullName(),
    submittedEquipment: null,
    otherEquipmentDetail: '',
    status: 'Broken',
    attempting: 'a thing',
    issue: 'it broke',
    steps: 'turned it on',
    ...overrides,
  });

describe('trouble tickets read model', () => {
  let framework: TestFramework;

  beforeEach(async () => {
    framework = await initTestFramework();
  });

  afterEach(() => {
    framework.close();
  });

  it('projects a TroubleTicketCreated as a Todo ticket', () => {
    const event = arbitraryTroubleTicketCreated();
    framework.insertIntoSharedReadModel(event);

    const ticket = getSomeOrFail(
      framework.sharedReadModel.troubleTickets.getById(event.id)
    );
    expect(ticket.id).toStrictEqual(event.id);
    expect(ticket.status).toStrictEqual('Todo');
    expect(ticket.submittedMemberNumber).toStrictEqual(
      event.submittedMemberNumber
    );
    expect(ticket.response).toStrictEqual({
      otherEquipmentDetail: '',
      status: 'Broken',
      attempting: 'a thing',
      issue: 'it broke',
      steps: 'turned it on',
    });
  });

  it('reports whether a rowHash has been imported', () => {
    const event = arbitraryTroubleTicketCreated();
    expect(
      framework.sharedReadModel.troubleTickets.hasRowHash(event.rowHash)
    ).toBe(false);
    framework.insertIntoSharedReadModel(event);
    expect(
      framework.sharedReadModel.troubleTickets.hasRowHash(event.rowHash)
    ).toBe(true);
  });

  it('is idempotent - a second event with the same rowHash is ignored', () => {
    const rowHash = faker.string.hexadecimal({length: 64});
    framework.insertIntoSharedReadModel(
      arbitraryTroubleTicketCreated({rowHash})
    );
    framework.insertIntoSharedReadModel(
      arbitraryTroubleTicketCreated({rowHash})
    );
    expect(framework.sharedReadModel.troubleTickets.getAll()).toHaveLength(1);
  });

  it('carries null submitter fields through', () => {
    const event = arbitraryTroubleTicketCreated({
      submittedMemberNumber: null,
      submittedEmail: null,
      submittedName: null,
      submittedEquipment: null,
    });
    framework.insertIntoSharedReadModel(event);
    const ticket = getSomeOrFail(
      framework.sharedReadModel.troubleTickets.getById(event.id)
    );
    expect(ticket.submittedMemberNumber).toBeNull();
    expect(ticket.submittedEmail).toBeNull();
    expect(ticket.submittedName).toBeNull();
    expect(ticket.equipmentId).toBeNull();
  });

  describe('equipment resolution', () => {
    const createEquipmentNamed = async (name: string): Promise<UUID> => {
      const areaId = faker.string.uuid() as UUID;
      const equipmentId = faker.string.uuid() as UUID;
      await framework.commands.area.create({
        id: areaId,
        name: faker.company.buzzNoun() as NonEmptyString,
      });
      await framework.commands.equipment.add({
        id: equipmentId,
        name: name as NonEmptyString,
        areaId,
      });
      return equipmentId;
    };

    it('resolves a matching equipment name (case/space insensitive)', async () => {
      const equipmentId = await createEquipmentNamed('Bambu 3D Printer');
      const event = arbitraryTroubleTicketCreated({
        submittedEquipment: '  bambu 3d printer ',
      });
      framework.insertIntoSharedReadModel(event);

      const ticket = getSomeOrFail(
        framework.sharedReadModel.troubleTickets.getById(event.id)
      );
      expect(ticket.equipmentId).toStrictEqual(equipmentId);
      expect(
        framework.sharedReadModel.troubleTickets.getByEquipment(equipmentId)
      ).toHaveLength(1);
    });

    it('leaves unmatched equipment in the Unassigned bucket', async () => {
      await createEquipmentNamed('Metal Lathe');
      const event = arbitraryTroubleTicketCreated({
        submittedEquipment: 'Something else entirely',
      });
      framework.insertIntoSharedReadModel(event);

      const ticket = getSomeOrFail(
        framework.sharedReadModel.troubleTickets.getById(event.id)
      );
      expect(ticket.equipmentId).toBeNull();
      const unassigned =
        framework.sharedReadModel.troubleTickets.getByEquipment(null);
      expect(unassigned.map(t => t.id)).toContain(event.id);
    });
  });
});
