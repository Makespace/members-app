import * as O from 'fp-ts/Option';
import * as E from 'fp-ts/Either';
import {faker} from '@faker-js/faker';
import {UUID} from 'io-ts-types';
import jwt from 'jsonwebtoken';
import {constructEvent} from '../../../src/types';
import {EmailAddress} from '../../../src/types/email-address';
import {UserActor} from '../../../src/types/actor';
import {getRightOrFail, systemActor} from '../../helpers';
import {claim} from '../../../src/commands/trouble-tickets/claim';
import {claimUrl} from '../../../src/trouble-tickets/claim-token';
import {applyCommand} from '../../../src/commands/apply-command';
import {
  TestFramework,
  initTestFramework,
} from '../../read-models/test-framework';

const REPORTER = 77;
const SOMEBODY_ELSE = 78;

const actorFor = (memberNumber: number): UserActor => ({
  tag: 'user',
  user: {
    emailAddress: `${memberNumber}@test.com` as EmailAddress,
    memberNumber,
  },
});

describe('claiming a ticket raised without logging in', () => {
  let framework: TestFramework;
  let ticketId: UUID;

  const tokenFor = (id: UUID) =>
    new URL(claimUrl(framework.depsForCommands.conf, id)).searchParams.get(
      'token'
    ) as string;

  const claimAs = (memberNumber: number, token: string) =>
    applyCommand(framework.depsForCommands, claim)(
      {token},
      actorFor(memberNumber)
    )();

  const ticket = () =>
    O.toNullable(framework.sharedReadModel.troubleTickets.getById(ticketId));

  beforeEach(async () => {
    framework = await initTestFramework();
    ticketId = faker.string.uuid() as UUID;
    for (const memberNumber of [REPORTER, SOMEBODY_ELSE]) {
      await framework.commands.memberNumbers.linkNumberToEmail({
        memberNumber,
        email: `${memberNumber}@test.com` as EmailAddress,
        name: undefined,
        formOfAddress: undefined,
      });
    }
    getRightOrFail(
      await framework.depsForCommands.commitEvent(
        framework.sharedReadModel.getCurrentEventIndex()
      )(
        constructEvent('TroubleTicketCreated')({
          actor: {tag: 'public'},
          id: ticketId,
          rowHash: `app:${faker.string.uuid()}`,
          sheetId: 'app',
          submittedAt: new Date(),
          submittedMemberNumber: null,
          providedMemberNumber: REPORTER,
          submittedEmail: 'personal@elsewhere.com',
          submittedName: 'Mem Ber',
          submittedEquipment: null,
          equipmentId: null,
          machine: '',
          areaId: null,
          title: '',
          mailboxConversationId: '',
          source: 'public',
          otherEquipmentDetail: 'The vice by the door',
          status: '',
          attempting: '',
          issue: 'The jaw is loose',
          steps: '',
        })
      )()
    );
  });

  afterEach(() => {
    framework.close();
  });

  it('puts the ticket on the account of whoever follows the link', async () => {
    getRightOrFail(await claimAs(REPORTER, tokenFor(ticketId)));

    expect(ticket()).toEqual(
      expect.objectContaining({
        submittedMemberNumber: REPORTER,
        // Now it is known whose it is, what they typed is beside the point.
        providedMemberNumber: null,
      })
    );
  });

  it('says so on the ticket', async () => {
    getRightOrFail(await claimAs(REPORTER, tokenFor(ticketId)));

    const changes =
      framework.sharedReadModel.troubleTickets.getChangeLog([ticketId]);
    expect(changes.map(change => change.eventType)).toContain(
      'TroubleTicketClaimed'
    );
  });

  it('does nothing when it is already theirs', async () => {
    getRightOrFail(await claimAs(REPORTER, tokenFor(ticketId)));
    const before = (await framework.getAllEvents()).length;

    getRightOrFail(await claimAs(REPORTER, tokenFor(ticketId)));

    expect(await framework.getAllEvents()).toHaveLength(before);
  });

  // A forwarded link must not move a ticket off the account it is on.
  it('refuses once the ticket is on somebody else', async () => {
    getRightOrFail(await claimAs(REPORTER, tokenFor(ticketId)));

    const result = await claimAs(SOMEBODY_ELSE, tokenFor(ticketId));

    expect(E.isLeft(result)).toBe(true);
    expect(ticket()?.submittedMemberNumber).toStrictEqual(REPORTER);
  });

  it('refuses a link we did not sign', async () => {
    const forged = jwt.sign(
      {purpose: 'TroubleTicketClaim', ticketId},
      'some other secret'
    );

    expect(E.isLeft(await claimAs(REPORTER, forged))).toBe(true);
    expect(ticket()?.submittedMemberNumber).toBeNull();
  });

  // Our tokens sign other things too, such as log in links; one of those is
  // not a claim on a ticket.
  it('refuses a token we signed for something else', async () => {
    const other = jwt.sign(
      {purpose: 'MagicLinkToken', ticketId},
      framework.depsForCommands.conf.TOKEN_SECRET
    );

    expect(E.isLeft(await claimAs(REPORTER, other))).toBe(true);
  });

  it('needs somebody logged in', () => {
    expect(
      claim.isAuthorized({
        actor: systemActor(),
        rm: framework.sharedReadModel,
        input: {token: tokenFor(ticketId)},
      })
    ).toBe(false);
  });
});
