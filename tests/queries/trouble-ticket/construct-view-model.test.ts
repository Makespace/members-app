import * as E from 'fp-ts/Either';
import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';
import {constructViewModel} from '../../../src/queries/trouble-ticket/construct-view-model';
import {Dependencies} from '../../../src/dependencies';
import {arbitraryUser} from '../../types/user.helper';
import {arbitraryActor, getRightOrFail} from '../../helpers';
import {constructEvent} from '../../../src/types';
import {
  TestFramework,
  initTestFramework,
} from '../../read-models/test-framework';

// A ticket at its own address. The board is the whole backlog and belongs to
// owners; one ticket is narrower, because whoever reported it is sent a link
// to it and a link they cannot open is no link at all.
describe('one trouble ticket on its own page', () => {
  let framework: TestFramework;
  let deps: Dependencies;
  const managementAreaId = faker.string.uuid() as UUID;
  const woodAreaId = faker.string.uuid() as UUID;
  const equipmentId = faker.string.uuid() as UUID;
  const owner = arbitraryUser();
  const reporter = arbitraryUser();
  const stranger = arbitraryUser();
  const manager = arbitraryUser();

  const raise = async (options: {
    id: UUID;
    reportedBy?: typeof reporter;
    areaId?: UUID;
    onEquipment?: boolean;
  }) =>
    getRightOrFail(
      await framework.depsForCommands.commitEvent(
        framework.sharedReadModel.getCurrentEventIndex()
      )(
        constructEvent('TroubleTicketCreated')({
          id: options.id,
          rowHash: faker.string.hexadecimal({length: 64}),
          sheetId: 'sheet',
          submittedAt: new Date(),
          submittedMemberNumber:
            options.reportedBy === undefined
              ? null
              : options.reportedBy.memberNumber,
          submittedEmail:
            options.reportedBy === undefined
              ? null
              : options.reportedBy.emailAddress,
          submittedName: null,
          submittedEquipment: null,
          otherEquipmentDetail: '',
          status: 'Broken',
          attempting: '',
          issue: 'The blade is blunt',
          steps: '',
          source: options.areaId === undefined ? 'sheet' : 'email',
          equipmentId: options.onEquipment === false ? null : equipmentId,
          machine: '',
          areaId: options.areaId ?? null,
          title: 'The blade is blunt',
          mailboxConversationId:
            options.areaId === undefined ? '' : faker.string.alphanumeric(16),
          actor: arbitraryActor(),
        })
      )()
    );

  const open = (user: typeof owner, id: string) =>
    constructViewModel(deps, id)(user)();

  beforeEach(async () => {
    framework = await initTestFramework();
    deps = {
      ...framework.depsForCommands,
      conf: {
        ...framework.depsForCommands.conf,
        MANAGEMENT_TEAM_AREA_ID: managementAreaId,
      },
    };
    for (const member of [owner, reporter, stranger, manager]) {
      await framework.commands.memberNumbers.linkNumberToEmail({
        memberNumber: member.memberNumber,
        email: member.emailAddress,
        name: undefined,
        formOfAddress: undefined,
      });
    }
    await framework.commands.area.create({
      id: managementAreaId,
      name: 'Management Team' as NonEmptyString,
    });
    await framework.commands.area.create({
      id: woodAreaId,
      name: 'Wood Shop' as NonEmptyString,
    });
    await framework.commands.equipment.add({
      id: equipmentId,
      name: 'Band Saw' as NonEmptyString,
      areaId: woodAreaId,
    });
    await framework.commands.area.addOwner({
      areaId: woodAreaId,
      memberNumber: owner.memberNumber,
    });
    await framework.commands.area.addOwner({
      areaId: managementAreaId,
      memberNumber: manager.memberNumber,
    });
  });

  afterEach(() => framework.close());

  it('shows an owner a ticket in their area', async () => {
    const id = faker.string.uuid() as UUID;
    await raise({id});

    const result = await open(owner, id);

    expect(E.isRight(result)).toBe(true);
    expect(getRightOrFail(result).title).toStrictEqual('The blade is blunt');
  });

  // The whole point of the address: the email about it links here.
  it('shows the person who reported it their own ticket, though they own nothing', async () => {
    const id = faker.string.uuid() as UUID;
    await raise({id, reportedBy: reporter});

    const result = await open(reporter, id);

    expect(E.isRight(result)).toBe(true);
  });

  it('tells somebody with no connection to it that there is no such ticket', async () => {
    const id = faker.string.uuid() as UUID;
    await raise({id});

    const result = await open(stranger, id);

    expect(E.isLeft(result)).toBe(true);
  });

  // Saying "you may not see this" confirms it exists, which is the thing
  // being withheld.
  it('answers the same way for a ticket that does not exist at all', async () => {
    const real = faker.string.uuid() as UUID;
    await raise({id: real});

    const missing = await open(stranger, faker.string.uuid());
    const hidden = await open(stranger, real);

    expect(E.isLeft(missing) && E.isLeft(hidden)).toBe(true);
  });

  // Correspondence with the management team is not every owner's to read,
  // and an address for it must not become the way round that.
  it('hides a management ticket from an area owner who is not on that team', async () => {
    const id = faker.string.uuid() as UUID;
    await raise({id, areaId: managementAreaId, onEquipment: false});

    expect(E.isLeft(await open(owner, id))).toBe(true);
    expect(E.isRight(await open(manager, id))).toBe(true);
  });

  it('names the area the machine is in, which the board never said', async () => {
    const id = faker.string.uuid() as UUID;
    await raise({id});

    const ticket = getRightOrFail(await open(owner, id));

    expect(ticket.equipmentName).toStrictEqual({
      _tag: 'Some',
      value: 'Band Saw',
    });
    expect(ticket.areaName).toStrictEqual({_tag: 'Some', value: 'Wood Shop'});
  });

  // The history of a ticket is most of why it deserves a page of its own.
  it('carries what has happened to it since', async () => {
    const id = faker.string.uuid() as UUID;
    await raise({id});
    getRightOrFail(
      await framework.depsForCommands.commitEvent(
        framework.sharedReadModel.getCurrentEventIndex()
      )(
        constructEvent('TroubleTicketResolved')({
          actor: arbitraryActor(),
          ticketId: id,
          summary: 'Fitted a new blade',
          quiet: false,
        })
      )()
    );

    const ticket = getRightOrFail(await open(owner, id));

    expect(ticket.status).toStrictEqual('Resolved');
    expect(ticket.changeLog.length).toBeGreaterThan(0);
  });
});
