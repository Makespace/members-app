import {faker} from '@faker-js/faker';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {StatusCodes} from 'http-status-codes';
import {NonEmptyString, UUID} from 'io-ts-types';
import {invite} from '../../../src/commands/trouble-tickets/invite';
import {declineInvitation} from '../../../src/commands/trouble-tickets/decline-invitation';
import {UserActor} from '../../../src/types/actor';
import {EmailAddress} from '../../../src/types/email-address';
import {getTaskEitherRightOrFail} from '../../helpers';
import {
  TestFramework,
  initTestFramework,
} from '../../read-models/test-framework';

const WORKING = 12; // an owner of the area, on the ticket
const COLLEAGUE = 13; // an owner of the area, not on it
const OUTSIDER = 99; // a member who owns nothing

const actorFor = (memberNumber: number): UserActor => ({
  tag: 'user',
  user: {
    emailAddress: `member${memberNumber}@example.com` as EmailAddress,
    memberNumber,
  },
});

// An owner working a ticket can ask another owner to help. The invitee
// joins by accepting - assigning themselves - or declines.
describe('inviting another owner to help with a ticket', () => {
  let framework: TestFramework;
  let ticketId: UUID;

  const rm = () => framework.sharedReadModel;
  const pending = () =>
    rm()
      .troubleTickets.getInvitations([ticketId])
      .map(invitation => invitation.inviteeMemberNumber);

  beforeEach(async () => {
    framework = await initTestFramework();
    const areaId = faker.string.uuid() as UUID;
    for (const memberNumber of [WORKING, COLLEAGUE, OUTSIDER]) {
      await framework.commands.memberNumbers.linkNumberToEmail({
        memberNumber,
        email: `member${memberNumber}@example.com` as EmailAddress,
        name: undefined,
        formOfAddress: undefined,
      });
    }
    await framework.commands.area.create({
      id: areaId,
      name: 'Wood Shop' as NonEmptyString,
    });
    await framework.commands.equipment.add({
      id: faker.string.uuid() as UUID,
      name: 'Band Saw' as NonEmptyString,
      areaId,
    });
    for (const memberNumber of [WORKING, COLLEAGUE]) {
      await framework.commands.area.addOwner({areaId, memberNumber});
    }
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
    ticketId = rm().troubleTickets.getAll()[0].id;
    await framework.commands.troubleTickets.assign({
      ticketId,
      comment: '',
      actor: actorFor(WORKING),
    });
  });

  afterEach(() => {
    framework.close();
  });

  const inviteColleague = () =>
    framework.commands.troubleTickets.invite({
      ticketId,
      memberNumber: COLLEAGUE,
      message: 'Two pairs of hands',
      actor: actorFor(WORKING),
    });

  describe('who may invite', () => {
    const mayInvite = (memberNumber: number) =>
      invite.isAuthorized({
        actor: actorFor(memberNumber),
        rm: rm(),
        input: {ticketId, memberNumber: COLLEAGUE, message: ''},
      });

    it('is an owner working on the ticket', () => {
      expect(mayInvite(WORKING)).toBe(true);
    });

    // It is "come and help me", not a way to hand out work.
    it('is not an owner who is not on it', () => {
      expect(mayInvite(COLLEAGUE)).toBe(false);
    });

    it('is not somebody who owns nothing', () => {
      expect(mayInvite(OUTSIDER)).toBe(false);
    });
  });

  describe('who may be invited', () => {
    const inviting = (memberNumber: number) =>
      invite.process({
        command: {
          ticketId,
          memberNumber,
          message: '',
          actor: actorFor(WORKING),
        },
        rm: rm(),
      })();

    it('is another owner of the area', async () => {
      expect(await inviting(COLLEAGUE)).toStrictEqual(
        E.right(
          O.some(
            expect.objectContaining({
              type: 'TroubleTicketInvitationSent',
              inviteeMemberNumber: COLLEAGUE,
            })
          )
        )
      );
    });

    it('is not somebody who could not work on it', async () => {
      const result = await inviting(OUTSIDER);
      expect(E.isLeft(result) && result.left.status).toBe(
        StatusCodes.BAD_REQUEST
      );
    });

    it('needs no asking twice', async () => {
      await inviteColleague();
      expect(await inviting(COLLEAGUE)).toStrictEqual(E.right(O.none));
    });

    it('is not somebody already on it', async () => {
      expect(await inviting(WORKING)).toStrictEqual(E.right(O.none));
    });
  });

  it('leaves the invitation waiting, without assigning anybody', async () => {
    await inviteColleague();

    expect(pending()).toStrictEqual([COLLEAGUE]);
    expect(
      O.map(
        (ticket: {assignedMemberNumbers: ReadonlyArray<number>}) =>
          ticket.assignedMemberNumbers
      )(rm().troubleTickets.getById(ticketId))
    ).toStrictEqual(O.some([WORKING]));
  });

  describe('once invited', () => {
    beforeEach(inviteColleague);

    // Accepting is joining: the invitee assigns themselves.
    it('is answered by the invitee assigning themselves', async () => {
      await framework.commands.troubleTickets.assign({
        ticketId,
        comment: '',
        actor: actorFor(COLLEAGUE),
      });

      expect(pending()).toStrictEqual([]);
      expect(
        O.map((ticket: {assignedMemberNumbers: ReadonlyArray<number>}) =>
          [...ticket.assignedMemberNumbers].sort()
        )(rm().troubleTickets.getById(ticketId))
      ).toStrictEqual(O.some([WORKING, COLLEAGUE].sort()));
    });

    it('can be declined by the invitee, saying who asked', async () => {
      const declined = await getTaskEitherRightOrFail(
        declineInvitation.process({
          command: {ticketId, actor: actorFor(COLLEAGUE)},
          rm: rm(),
        })
      );
      expect(declined).toStrictEqual(
        O.some(
          expect.objectContaining({
            type: 'TroubleTicketInvitationDeclined',
            inviterMemberNumber: WORKING,
          })
        )
      );

      await framework.commands.troubleTickets.declineInvitation({
        ticketId,
        actor: actorFor(COLLEAGUE),
      });
      expect(pending()).toStrictEqual([]);
    });

    it('cannot be declined by anybody else', () => {
      expect(
        declineInvitation.isAuthorized({
          actor: actorFor(WORKING),
          rm: rm(),
          input: {ticketId},
        })
      ).toBe(false);
    });

    it('lapses when the ticket is resolved', async () => {
      await framework.commands.troubleTickets.resolve({
        ticketId,
        summary: 'Fixed it alone after all',
        quiet: false,
        actor: actorFor(WORKING),
      });

      expect(pending()).toStrictEqual([]);
    });
  });
});
