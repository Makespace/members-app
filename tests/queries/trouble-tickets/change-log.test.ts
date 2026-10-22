import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';
import {buildChangeLog} from '../../../src/queries/trouble-tickets/construct-view-model';
import {UserActor} from '../../../src/types/actor';
import {EmailAddress} from '../../../src/types/email-address';
import {
  TestFramework,
  initTestFramework,
} from '../../read-models/test-framework';

const OWNER = 12;
const SUPER_USER = 50;

const actorFor = (memberNumber: number): UserActor => ({
  tag: 'user',
  user: {
    emailAddress: `member${memberNumber}@example.com` as EmailAddress,
    memberNumber,
  },
});

// The change log says who did what, so a ticket handed on reads differently
// from one somebody picked up themselves.
describe('a ticket change log, on assignment', () => {
  let framework: TestFramework;
  let ticketId: UUID;

  beforeEach(async () => {
    framework = await initTestFramework();
    const areaId = faker.string.uuid() as UUID;
    for (const [memberNumber, name] of [
      [OWNER, 'Olu Owner'],
      [SUPER_USER, 'Ada Admin'],
    ] as const) {
      await framework.commands.memberNumbers.linkNumberToEmail({
        memberNumber,
        email: `member${memberNumber}@example.com` as EmailAddress,
        name,
        formOfAddress: undefined,
      });
    }
    await framework.commands.superUser.declare({memberNumber: SUPER_USER});
    await framework.commands.area.create({
      id: areaId,
      name: 'Wood Shop' as NonEmptyString,
    });
    await framework.commands.equipment.add({
      id: faker.string.uuid() as UUID,
      name: 'Band Saw' as NonEmptyString,
      areaId,
    });
    await framework.commands.area.addOwner({areaId, memberNumber: OWNER});
    await framework.commands.troubleTickets.record({
      id: faker.string.uuid() as UUID,
      rowHash: faker.string.alphanumeric(64) as NonEmptyString,
      sheetId: faker.string.alphanumeric(10) as NonEmptyString,
      submittedAt: faker.date.past(),
      submittedMemberNumber: null,
      submittedEmail: null,
      submittedName: null,
      submittedEquipment: 'Band Saw',
      otherEquipmentDetail: '',
      status: 'Down',
      attempting: '',
      issue: 'Blade wanders',
      steps: '',
    });
    ticketId = framework.sharedReadModel.troubleTickets.getAll()[0].id;
  });

  afterEach(() => {
    framework.close();
  });

  const latestSummary = () => {
    const log = buildChangeLog(
      framework.sharedReadModel.troubleTickets.getChangeLog([ticketId]),
      framework.sharedReadModel
    );
    return log[log.length - 1];
  };

  it('names who a super-user assigned the ticket to', async () => {
    await framework.commands.troubleTickets.assignTo({
      ticketId,
      memberNumber: OWNER,
      comment: '',
      actor: actorFor(SUPER_USER),
    });

    expect(latestSummary()).toMatchObject({
      actor: 'Ada Admin',
      summary: 'assigned Olu Owner and set the ticket to In Progress',
    });
  });

  it('still says "themselves" when somebody picks a ticket up', async () => {
    await framework.commands.troubleTickets.assign({
      ticketId,
      comment: '',
      actor: actorFor(OWNER),
    });

    expect(latestSummary()).toMatchObject({
      actor: 'Olu Owner',
      summary: 'assigned themselves and set the ticket to In Progress',
    });
  });
});
