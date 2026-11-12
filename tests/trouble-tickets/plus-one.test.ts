import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {Int} from 'io-ts';
import {UUID} from 'io-ts-types';
import {faker} from '@faker-js/faker';
import {Request, Response} from 'express';
import {Actor, EmailAddress} from '../../src/types';
import {CompleteHtmlDocument} from '../../src/types/html';
import {setPlusOne} from '../../src/commands/trouble-tickets/set-plus-one';
import {applyCommand} from '../../src/commands/apply-command';
import {formPost} from '../../src/http/form-post';
import {initRoutes} from '../../src/routes';
import {constructViewModel as detail} from '../../src/queries/trouble-ticket/construct-view-model';
import {constructViewModel as board} from '../../src/queries/trouble-tickets/construct-view-model';
import {
  TestFramework,
  initTestFramework,
} from '../read-models/test-framework';
import {getLeftOrFail, getRightOrFail, getSomeOrFail} from '../helpers';

const user = (memberNumber: number) => ({
  memberNumber,
  emailAddress: `member${memberNumber}@example.com` as EmailAddress,
});
const actor = (number: number): Actor => ({tag: 'user', user: user(number)});

describe('ticket +1', () => {
  let framework: TestFramework;
  let ticketId: UUID;
  const member = 101;
  const other = 102;

  beforeEach(async () => {
    framework = await initTestFramework();
    ticketId = faker.string.uuid() as UUID;
    for (const number of [member, other]) {
      await framework.commands.memberNumbers.linkNumberToEmail({
        memberNumber: number,
        email: user(number).emailAddress,
        name: undefined,
        formOfAddress: undefined,
      });
    }
    await framework.commands.troubleTickets.create({
      id: ticketId,
      submittedEquipment: null,
      submittedMemberNumber: member,
      submittedEmail: user(member).emailAddress,
      submittedName: 'Reporter',
      otherEquipmentDetail: '',
      status: 'Broken',
      attempting: '',
      issue: 'Needs attention',
      steps: '',
    });
    await framework.commands.troubleTickets.setPermission({
      ticketId,
      permission: 'everybody',
    });
  });
  afterEach(() => framework.close());

  const vote = (number: number, plusOne: boolean) =>
    framework.commands.troubleTickets.setPlusOne({
      ticketId,
      plusOne,
      actor: actor(number),
    });
  const ticket = () =>
    getSomeOrFail(framework.sharedReadModel.troubleTickets.getById(ticketId));
  const events = () =>
    framework.getAllEventsByType('TroubleTicketPlusOneSet');

  it('starts with no votes', () => {
    expect(ticket().plusOneMemberNumbers).toEqual([]);
  });

  it('emits the vote for the authenticated member, ignoring a supplied member number', async () => {
    const input = getRightOrFail(
      setPlusOne.decode({
        ticketId,
        plusOne: 'true',
        memberNumber: other,
      })
    );
    const event = getSomeOrFail(
      getRightOrFail(
        await setPlusOne.process({
          command: {...input, actor: actor(member)},
          rm: framework.sharedReadModel,
          deps: framework.depsForCommands,
        })()
      )
    );
    expect(event).toMatchObject({
      type: 'TroubleTicketPlusOneSet',
      memberNumber: member,
      ticketId,
      plusOne: true,
    });
  });

  it('saves one vote per member across retries and projection rebuilds', async () => {
    await vote(member, true);
    await vote(member, true);
    await vote(other, true);
    await framework.sharedReadModel.reset();
    expect(ticket().plusOneMemberNumbers).toEqual(
      expect.arrayContaining([member, other])
    );
    expect(ticket().plusOneMemberNumbers).toHaveLength(2);
    expect(await events()).toHaveLength(2);
    expect(ticket().status).toBe('Todo');
    expect(ticket().assignedMemberNumbers).toEqual([]);
  });

  it('removes only the acting member’s vote and makes removal idempotent', async () => {
    await vote(member, true);
    await vote(other, true);
    await vote(member, false);
    await vote(member, false);
    expect(ticket().plusOneMemberNumbers).toEqual([other]);
    expect(await events()).toHaveLength(3);
    await framework.sharedReadModel.reset();
    expect(ticket().plusOneMemberNumbers).toEqual([other]);
  });

  it('shows the count and personal selection on the board and detail page', async () => {
    await vote(member, true);
    const deps = framework.depsForCommands;
    const mine = getRightOrFail(await detail(deps, ticketId)(user(member))());
    const theirs = getRightOrFail(
      await detail(deps, ticketId)(user(other))()
    );
    expect(mine).toMatchObject({plusOneCount: 1, hasPlusOne: true});
    expect(theirs).toMatchObject({
      plusOneCount: 1,
      hasPlusOne: false,
      canChangeStatus: false,
    });
    const list = getRightOrFail(
      await board(deps, {
        page: 1,
        status: O.none,
        only: O.none,
      })(user(member))()
    );
    expect(list.tickets[0]).toMatchObject({
      plusOneCount: 1,
      hasPlusOne: true,
    });
  });

  it('counts linked member numbers once and removes all linked votes', async () => {
    await vote(member, true);
    await vote(other, true);
    await framework.commands.memberNumbers.markMemberRejoinedWithNewNumber({
      oldMemberNumber: member as Int,
      newMemberNumber: other as Int,
      carryOverTraining: true,
    });
    expect(ticket().plusOneMemberNumbers).toHaveLength(1);
    await vote(other, true);
    expect(await events()).toHaveLength(2);
    const view = getRightOrFail(
      await detail(framework.depsForCommands, ticketId)(user(other))()
    );
    expect(view).toMatchObject({plusOneCount: 1, hasPlusOne: true});
    await vote(other, false);
    expect(ticket().plusOneMemberNumbers).toEqual([]);
    await framework.sharedReadModel.reset();
    expect(ticket().plusOneMemberNumbers).toEqual([]);
  });

  it('rejects votes and withdrawals after the member loses visibility', async () => {
    await vote(member, true);
    await framework.commands.troubleTickets.setPermission({
      ticketId,
      permission: 'area-owner',
    });
    const request = (id: UUID, plusOne: boolean) =>
      applyCommand(framework.depsForCommands, setPlusOne)(
        {ticketId: id, plusOne},
        actor(member)
      )();
    expect(getLeftOrFail(await request(ticketId, true)).status).toBe(404);
    expect(getLeftOrFail(await request(ticketId, false)).status).toBe(404);
    expect(
      getLeftOrFail(await request(faker.string.uuid() as UUID, true)).status
    ).toBe(404);
    expect(await events()).toHaveLength(1);
  });

  it('rejects tokens and unknown members', async () => {
    const request = (by: Actor) =>
      applyCommand(framework.depsForCommands, setPlusOne)(
        {ticketId, plusOne: true},
        by
      )();
    expect(
      getLeftOrFail(await request({tag: 'token', token: 'admin'})).status
    ).toBe(403);
    expect(getLeftOrFail(await request(actor(999))).status).toBe(401);
    expect(await events()).toHaveLength(0);
  });

  it('requires an explicit boolean so missing or malformed input cannot toggle a vote', () => {
    expect(
      getRightOrFail(setPlusOne.decode({ticketId, plusOne: 'false'})).plusOne
    ).toBe(false);
    expect(E.isLeft(setPlusOne.decode({ticketId}))).toBe(true);
    expect(E.isLeft(setPlusOne.decode({ticketId, plusOne: 'yes'}))).toBe(
      true
    );
    expect(
      E.isLeft(setPlusOne.decode({ticketId, plusOne: ['true', 'false']}))
    ).toBe(true);
  });

  it('saves the posted form and returns to the same board filters', async () => {
    const returnTo = '/trouble-tickets/board?show=all&status=todo&page=2';
    const res = {
      redirect: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    } as unknown as Response<CompleteHtmlDocument>;
    await formPost(
      framework.depsForCommands,
      setPlusOne,
      '/trouble-tickets/board'
    )(
      {
        session: {passport: {user: user(member)}},
        body: {ticketId, plusOne: 'true'},
        query: {next: returnTo},
      } as unknown as Request,
      res
    );
    expect(res.redirect).toHaveBeenCalledWith(returnTo);
    expect(await events()).toHaveLength(1);
    const routes = initRoutes(
      framework.depsForCommands,
      framework.depsForCommands.conf
    ).filter(route => route.path === '/trouble-tickets/set-plus-one');
    expect(routes.map(route => route.method)).toEqual(['post']);
  });

  it('refuses an anonymous form submission', async () => {
    const res = {
      redirect: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    } as unknown as Response<CompleteHtmlDocument>;
    await formPost(
      framework.depsForCommands,
      setPlusOne,
      '/trouble-tickets/board'
    )(
      {
        session: null,
        body: {ticketId, plusOne: 'true'},
        query: {},
      } as unknown as Request,
      res
    );
    expect(res.status).toHaveBeenCalledWith(401);
    expect(await events()).toHaveLength(0);
  });
});
