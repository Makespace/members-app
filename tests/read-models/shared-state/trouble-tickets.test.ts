import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {Int} from 'io-ts';
import {NonEmptyString, UUID} from 'io-ts-types';
import {TestFramework, initTestFramework} from '../test-framework';
import {getSomeOrFail} from '../../helpers';

const arbitraryTicket = () => ({
  id: faker.string.uuid() as UUID,
  rowHash: faker.string.alphanumeric(64) as NonEmptyString,
  sheetId: faker.string.alphanumeric(10) as NonEmptyString,
  submittedAt: faker.date.past(),
  submittedMemberNumber: faker.number.int({min: 1}) as Int,
  submittedEmail: faker.internet.email(),
  submittedName: faker.person.fullName(),
  submittedEquipment: null as string | null,
  otherEquipmentDetail: '',
  status: 'Machine is down',
  attempting: 'Cutting acrylic',
  issue: 'Laser lost power halfway through',
  steps: 'Checked the lens',
});

describe('trouble-tickets read model', () => {
  let framework: TestFramework;

  beforeEach(async () => {
    framework = await initTestFramework();
  });

  afterEach(() => {
    framework.close();
  });

  it('projects a created ticket with status Todo and title from the issue text', async () => {
    const ticket = arbitraryTicket();
    await framework.commands.troubleTickets.record(ticket);

    const tickets = framework.sharedReadModel.troubleTickets.getAll();
    expect(tickets).toHaveLength(1);
    expect(tickets[0]).toMatchObject({
      id: ticket.id,
      status: 'Todo',
      title: ticket.issue,
      submittedMemberNumber: ticket.submittedMemberNumber,
      submittedEmail: ticket.submittedEmail,
      equipmentId: null,
      assignedMemberNumbers: [],
      response: {
        otherEquipmentDetail: ticket.otherEquipmentDetail,
        status: ticket.status,
        attempting: ticket.attempting,
        issue: ticket.issue,
        steps: ticket.steps,
      },
    });
  });

  it('records the row hash for dedup', async () => {
    const ticket = arbitraryTicket();
    await framework.commands.troubleTickets.record(ticket);

    expect(
      framework.sharedReadModel.troubleTickets.hasRowHash(ticket.rowHash)
    ).toBe(true);
    expect(
      framework.sharedReadModel.troubleTickets.hasRowHash('unseen-hash')
    ).toBe(false);
  });

  it('keeps recognising the row hash after the ticket event is soft-deleted', async () => {
    // Deleting a ticket event (e.g. a data-removal request) must stick: if the
    // hash were forgotten, the ingest would re-import the cached sheet row.
    const ticket = arbitraryTicket();
    await framework.commands.troubleTickets.record(ticket);
    const [event] = await framework.getAllEventsByType('TroubleTicketCreated');

    await framework.depsForCommands.deleteEvent(
      event.event_index,
      'data removal request',
      1337 as Int
    )();
    await framework.sharedReadModel.reset();

    expect(framework.sharedReadModel.troubleTickets.getAll()).toHaveLength(0);
    expect(
      framework.sharedReadModel.troubleTickets.hasRowHash(ticket.rowHash)
    ).toBe(true);
  });

  it('finds a ticket by id', async () => {
    const ticket = arbitraryTicket();
    await framework.commands.troubleTickets.record(ticket);

    const found = getSomeOrFail(
      framework.sharedReadModel.troubleTickets.getById(ticket.id)
    );
    expect(found.id).toStrictEqual(ticket.id);
    expect(
      O.isNone(
        framework.sharedReadModel.troubleTickets.getById(
          faker.string.uuid() as UUID
        )
      )
    ).toBe(true);
  });

  describe('equipment resolution', () => {
    const areaId = faker.string.uuid() as UUID;
    const equipmentId = faker.string.uuid() as UUID;

    beforeEach(async () => {
      await framework.commands.area.create({
        id: areaId,
        name: 'Wood Shop' as NonEmptyString,
      });
      await framework.commands.equipment.add({
        id: equipmentId,
        name: 'Big Laser' as NonEmptyString,
        areaId,
      });
    });

    it('resolves the raw equipment string case- and whitespace-insensitively', async () => {
      await framework.commands.troubleTickets.record({
        ...arbitraryTicket(),
        submittedEquipment: '  big laser ',
      });

      const [ticket] = framework.sharedReadModel.troubleTickets.getAll();
      expect(ticket.equipmentId).toStrictEqual(equipmentId);
    });

    it('leaves equipmentId null when the string matches nothing (Unassigned)', async () => {
      await framework.commands.troubleTickets.record({
        ...arbitraryTicket(),
        submittedEquipment: 'Some machine we do not have',
      });

      const [ticket] = framework.sharedReadModel.troubleTickets.getAll();
      expect(ticket.equipmentId).toBeNull();
    });

    it('late-binds a ticket recorded before its equipment existed', async () => {
      // A backfilled historical ticket replays earlier in the log than the
      // EquipmentAdded event for the machine it names; the link must be made
      // when the equipment arrives.
      await framework.commands.troubleTickets.record({
        ...arbitraryTicket(),
        submittedEquipment: 'CNC Router',
      });
      expect(
        framework.sharedReadModel.troubleTickets.getAll()[0].equipmentId
      ).toBeNull();

      const lateEquipmentId = faker.string.uuid() as UUID;
      await framework.commands.equipment.add({
        id: lateEquipmentId,
        name: 'CNC Router' as NonEmptyString,
        areaId,
      });

      const [ticket] = framework.sharedReadModel.troubleTickets.getAll();
      expect(ticket.equipmentId).toStrictEqual(lateEquipmentId);
    });
  });
});
