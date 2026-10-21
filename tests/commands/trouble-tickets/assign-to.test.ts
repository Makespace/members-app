import {faker} from '@faker-js/faker';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {StatusCodes} from 'http-status-codes';
import {NonEmptyString, UUID} from 'io-ts-types';
import {assignTo} from '../../../src/commands/trouble-tickets/assign-to';
import {UserActor} from '../../../src/types/actor';
import {EmailAddress} from '../../../src/types/email-address';
import {getTaskEitherRightOrFail} from '../../helpers';
import {
  TestFramework,
  initTestFramework,
} from '../../read-models/test-framework';

const OWNER = 12;
const SUPER_USER = 50;
const OUTSIDER = 99;

const actorFor = (memberNumber: number): UserActor => ({
  tag: 'user',
  user: {
    emailAddress: `member${memberNumber}@example.com` as EmailAddress,
    memberNumber,
  },
});

describe('assigning a trouble ticket to someone else', () => {
  let framework: TestFramework;
  let ticketId: UUID;

  beforeEach(async () => {
    framework = await initTestFramework();
    const areaId = faker.string.uuid() as UUID;
    for (const memberNumber of [OWNER, SUPER_USER, OUTSIDER]) {
      await framework.commands.memberNumbers.linkNumberToEmail({
        memberNumber,
        email: `member${memberNumber}@example.com` as EmailAddress,
        name: undefined,
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

  const assign = (memberNumber: number, actor = actorFor(SUPER_USER)) =>
    assignTo.process({
      command: {ticketId, memberNumber, comment: '', actor},
      rm: framework.sharedReadModel,
    })();

  describe('who may do it', () => {
    it('is a super-user', () => {
      expect(
        assignTo.isAuthorized({
          actor: actorFor(SUPER_USER),
          rm: framework.sharedReadModel,
          input: {ticketId, memberNumber: OWNER, comment: ''},
        })
      ).toBe(true);
    });

    // Owners can still pick a ticket up themselves; handing one on is not
    // theirs to do, for now.
    it('is not an owner of the area', () => {
      expect(
        assignTo.isAuthorized({
          actor: actorFor(OWNER),
          rm: framework.sharedReadModel,
          input: {ticketId, memberNumber: OWNER, comment: ''},
        })
      ).toBe(false);
    });
  });

  it('records the ticket as assigned to the member chosen, by the super-user', async () => {
    const result = await getTaskEitherRightOrFail(
      assignTo.process({
        command: {
          ticketId,
          memberNumber: OWNER,
          comment: ' Back on Tuesday ',
          actor: actorFor(SUPER_USER),
        },
        rm: framework.sharedReadModel,
      })
    );

    expect(result).toStrictEqual(
      O.some(
        expect.objectContaining({
          type: 'TroubleTicketAssigned',
          ticketId,
          trainerMemberNumber: OWNER,
          comment: 'Back on Tuesday',
          actor: actorFor(SUPER_USER),
        })
      )
    );
  });

  it('can go to another super-user', async () => {
    const result = await assign(SUPER_USER);

    expect(E.isRight(result) && O.isSome(result.right)).toBe(true);
  });

  // They could not open the ticket, and a management one must not reach them.
  it('cannot go to somebody who could not work on it', async () => {
    const result = await assign(OUTSIDER);

    expect(E.isLeft(result) && result.left.status).toBe(
      StatusCodes.BAD_REQUEST
    );
  });

  it('does nothing for somebody already on the ticket', async () => {
    await framework.commands.troubleTickets.assignTo({
      ticketId,
      memberNumber: OWNER,
      comment: '',
    });

    expect(await assign(OWNER)).toStrictEqual(E.right(O.none));
  });

  it('reads the member number the form sends as text', () => {
    const decoded = assignTo.decode({ticketId, memberNumber: '12'});

    expect(E.isRight(decoded) && decoded.right.memberNumber).toBe(12);
  });
});
