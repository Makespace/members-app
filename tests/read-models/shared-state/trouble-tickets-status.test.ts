import {faker} from '@faker-js/faker';
import {UUID} from 'io-ts-types';
import {constructEvent} from '../../../src/types';
import {EmailAddress} from '../../../src/types/email-address';
import {UserActor} from '../../../src/types/actor';
import {EventOfType} from '../../../src/types/domain-event';
import {getSomeOrFail, systemActor} from '../../helpers';
import {TestFramework, initTestFramework} from '../test-framework';

const userActorWithMember = (memberNumber: number): UserActor => ({
  tag: 'user',
  user: {
    emailAddress: `member${memberNumber}@test.com` as EmailAddress,
    memberNumber,
  },
});

const troubleTicketCreated = (
  overrides: Partial<EventOfType<'TroubleTicketCreated'>> = {}
): EventOfType<'TroubleTicketCreated'> =>
  constructEvent('TroubleTicketCreated')({
    actor: systemActor(),
    id: faker.string.uuid() as UUID,
    rowHash: faker.string.hexadecimal({length: 64}),
    sheetId: 'sheet-1',
    submittedAt: faker.date.past(),
    submittedMemberNumber: null,
    submittedEmail: null,
    submittedName: null,
    submittedEquipment: null,
    otherEquipmentDetail: '',
    status: 'Broken',
    attempting: 'a thing',
    issue: 'the original issue text',
    steps: '',
    ...overrides,
  });

describe('trouble ticket status workflow (read model)', () => {
  let framework: TestFramework;

  beforeEach(async () => {
    framework = await initTestFramework();
  });

  afterEach(() => {
    framework.close();
  });

  const linkMember = (memberNumber: number) =>
    framework.insertIntoSharedReadModel(
      constructEvent('MemberNumberLinkedToEmail')({
        actor: systemActor(),
        memberNumber,
        email: faker.internet.email() as EmailAddress,
        name: undefined,
        formOfAddress: undefined,
      })
    );

  it('defaults the title to the form issue text', () => {
    const created = troubleTicketCreated();
    framework.insertIntoSharedReadModel(created);
    const ticket = getSomeOrFail(
      framework.sharedReadModel.troubleTickets.getById(created.id)
    );
    expect(ticket.title).toStrictEqual('the original issue text');
  });

  it('first assignment moves a Todo ticket to In Progress and records the assignee', () => {
    const created = troubleTicketCreated();
    framework.insertIntoSharedReadModel(created);
    linkMember(12);
    framework.insertIntoSharedReadModel(
      constructEvent('TroubleTicketAssigned')({
        actor: userActorWithMember(12),
        ticketId: created.id,
        trainerMemberNumber: 12,
      })
    );

    const ticket = getSomeOrFail(
      framework.sharedReadModel.troubleTickets.getById(created.id)
    );
    expect(ticket.status).toStrictEqual('In Progress');
    expect(ticket.assignedMemberNumbers).toStrictEqual([12]);
  });

  it('supports multiple assignees', () => {
    const created = troubleTicketCreated();
    framework.insertIntoSharedReadModel(created);
    linkMember(12);
    linkMember(34);
    [12, 34].forEach(memberNumber =>
      framework.insertIntoSharedReadModel(
        constructEvent('TroubleTicketAssigned')({
          actor: userActorWithMember(memberNumber),
          ticketId: created.id,
          trainerMemberNumber: memberNumber,
        })
      )
    );
    const ticket = getSomeOrFail(
      framework.sharedReadModel.troubleTickets.getById(created.id)
    );
    expect([...ticket.assignedMemberNumbers].sort()).toStrictEqual([12, 34]);
  });

  it('resolving sets the status to Resolved', () => {
    const created = troubleTicketCreated();
    framework.insertIntoSharedReadModel(created);
    framework.insertIntoSharedReadModel(
      constructEvent('TroubleTicketResolved')({
        actor: systemActor(),
        ticketId: created.id,
        summary: 'turned it off and on again',
      })
    );
    expect(
      getSomeOrFail(framework.sharedReadModel.troubleTickets.getById(created.id))
        .status
    ).toStrictEqual('Resolved');
  });

  it('parking sets the status to Parked', () => {
    const created = troubleTicketCreated();
    framework.insertIntoSharedReadModel(created);
    framework.insertIntoSharedReadModel(
      constructEvent('TroubleTicketParked')({
        actor: systemActor(),
        ticketId: created.id,
        whyParked: 'awaiting part',
        pathToResolution: 'order the part',
        intermediateActions: 'label as out of service',
      })
    );
    expect(
      getSomeOrFail(framework.sharedReadModel.troubleTickets.getById(created.id))
        .status
    ).toStrictEqual('Parked');
  });

  it('needs-help sets the status and unassigns the flagging trainer', () => {
    const created = troubleTicketCreated();
    framework.insertIntoSharedReadModel(created);
    linkMember(12);
    framework.insertIntoSharedReadModel(
      constructEvent('TroubleTicketAssigned')({
        actor: userActorWithMember(12),
        ticketId: created.id,
        trainerMemberNumber: 12,
      })
    );
    framework.insertIntoSharedReadModel(
      constructEvent('TroubleTicketNeedsHelp')({
        actor: userActorWithMember(12),
        ticketId: created.id,
        whatTried: 'reseated the cable',
        whyDidntWork: 'still no power',
      })
    );

    const ticket = getSomeOrFail(
      framework.sharedReadModel.troubleTickets.getById(created.id)
    );
    expect(ticket.status).toStrictEqual('Needs Help');
    expect(ticket.assignedMemberNumbers).toStrictEqual([]);
  });

  it('picking up a Needs Help ticket moves it back to In Progress', () => {
    const created = troubleTicketCreated();
    framework.insertIntoSharedReadModel(created);
    linkMember(12);
    linkMember(34);
    framework.insertIntoSharedReadModel(
      constructEvent('TroubleTicketAssigned')({
        actor: userActorWithMember(12),
        ticketId: created.id,
        trainerMemberNumber: 12,
      })
    );
    framework.insertIntoSharedReadModel(
      constructEvent('TroubleTicketNeedsHelp')({
        actor: userActorWithMember(12),
        ticketId: created.id,
        whatTried: 'x',
        whyDidntWork: 'y',
      })
    );
    framework.insertIntoSharedReadModel(
      constructEvent('TroubleTicketAssigned')({
        actor: userActorWithMember(34),
        ticketId: created.id,
        trainerMemberNumber: 34,
      })
    );

    const ticket = getSomeOrFail(
      framework.sharedReadModel.troubleTickets.getById(created.id)
    );
    expect(ticket.status).toStrictEqual('In Progress');
    expect(ticket.assignedMemberNumbers).toStrictEqual([34]);
  });

  it('resolving clears the assignees', () => {
    const created = troubleTicketCreated();
    framework.insertIntoSharedReadModel(created);
    linkMember(12);
    framework.insertIntoSharedReadModel(
      constructEvent('TroubleTicketAssigned')({
        actor: userActorWithMember(12),
        ticketId: created.id,
        trainerMemberNumber: 12,
      })
    );
    framework.insertIntoSharedReadModel(
      constructEvent('TroubleTicketResolved')({
        actor: systemActor(),
        ticketId: created.id,
        summary: 'done',
      })
    );

    const ticket = getSomeOrFail(
      framework.sharedReadModel.troubleTickets.getById(created.id)
    );
    expect(ticket.status).toStrictEqual('Resolved');
    expect(ticket.assignedMemberNumbers).toStrictEqual([]);
  });

  it('editing the title updates it', () => {
    const created = troubleTicketCreated();
    framework.insertIntoSharedReadModel(created);
    framework.insertIntoSharedReadModel(
      constructEvent('TroubleTicketTitleEdited')({
        actor: systemActor(),
        ticketId: created.id,
        title: 'A clearer title',
      })
    );
    expect(
      getSomeOrFail(framework.sharedReadModel.troubleTickets.getById(created.id))
        .title
    ).toStrictEqual('A clearer title');
  });

  it('setting equipment moves the ticket between buckets', () => {
    const areaId = faker.string.uuid() as UUID;
    const equipmentId = faker.string.uuid() as UUID;
    framework.insertIntoSharedReadModel(
      constructEvent('AreaCreated')({actor: systemActor(), id: areaId, name: 'Area'})
    );
    framework.insertIntoSharedReadModel(
      constructEvent('EquipmentAdded')({
        actor: systemActor(),
        id: equipmentId,
        name: 'Test Rig',
        areaId,
        classification: 'Red',
      })
    );
    const created = troubleTicketCreated({submittedEquipment: 'unmatched thing'});
    framework.insertIntoSharedReadModel(created);
    expect(
      getSomeOrFail(framework.sharedReadModel.troubleTickets.getById(created.id))
        .equipmentId
    ).toBeNull();

    framework.insertIntoSharedReadModel(
      constructEvent('TroubleTicketEquipmentSet')({
        actor: systemActor(),
        ticketId: created.id,
        equipmentId,
      })
    );
    expect(
      getSomeOrFail(framework.sharedReadModel.troubleTickets.getById(created.id))
        .equipmentId
    ).toStrictEqual(equipmentId);
    expect(
      framework.sharedReadModel.troubleTickets
        .getByEquipment(equipmentId)
        .map(t => t.id)
    ).toContain(created.id);
  });
});
