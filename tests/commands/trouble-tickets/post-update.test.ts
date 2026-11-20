import {faker} from '@faker-js/faker';
import {StatusCodes} from 'http-status-codes';
import {NonEmptyString, UUID} from 'io-ts-types';
import {postUpdate} from '../../../src/commands/trouble-tickets/post-update';
import {buildChangeLog} from '../../../src/queries/trouble-tickets/construct-view-model';
import {describeTicketChange} from '../../../src/trouble-tickets/notification';
import {happeningOfEvent} from '../../../src/trouble-tickets/notification-audience';
import {UserActor} from '../../../src/types/actor';
import {EmailAddress} from '../../../src/types/email-address';
import {getLeftOrFail, getSomeOrFail} from '../../helpers';
import {
  TestFramework,
  initTestFramework,
} from '../../read-models/test-framework';
import * as O from 'fp-ts/Option';

const OWNER = 12;
const OUTSIDER = 99;

const actorFor = (memberNumber: number): UserActor => ({
  tag: 'user',
  user: {
    emailAddress: `member${memberNumber}@example.com` as EmailAddress,
    memberNumber,
  },
});

// Progress on a ticket somebody is working on - "ordered a part", "the part
// is stuck in customs" - posted as often as there is news, without moving
// the ticket on.
describe('posting updates on a trouble ticket', () => {
  let framework: TestFramework;
  let ticketId: UUID;

  beforeEach(async () => {
    framework = await initTestFramework();
    const areaId = faker.string.uuid() as UUID;
    for (const [memberNumber, name] of [
      [OWNER, 'Olu Owner'],
      [OUTSIDER, 'Otto Outsider'],
    ] as const) {
      await framework.commands.memberNumbers.linkNumberToEmail({
        memberNumber,
        email: `member${memberNumber}@example.com` as EmailAddress,
        name,
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
      issue: 'Blade snapped',
      steps: '',
    });
    ticketId = framework.sharedReadModel.troubleTickets.getAll()[0].id;
    await framework.commands.troubleTickets.assign({
      ticketId,
      comment: '',
      actor: actorFor(OWNER),
    });
  });

  afterEach(() => {
    framework.close();
  });

  const rm = () => framework.sharedReadModel;
  const post = (update: string) =>
    framework.commands.troubleTickets.postUpdate({
      ticketId,
      update: update as NonEmptyString,
      actor: actorFor(OWNER),
    });

  it('lets the area owner post, but not somebody unconnected', () => {
    const allowed = (memberNumber: number) =>
      postUpdate.isAuthorized({
        actor: actorFor(memberNumber),
        rm: rm(),
        input: {ticketId, update: 'x' as NonEmptyString},
      });
    expect(allowed(OWNER)).toBe(true);
    expect(allowed(OUTSIDER)).toBe(false);
  });

  it('requires something to say', () => {
    expect(postUpdate.decode({ticketId, update: ''})._tag).toBe('Left');
  });

  it('keeps every update in order, and leaves the status alone', async () => {
    await post("I've ordered a new blade.");
    await post("Still waiting for the blade - it's stuck in customs.");

    expect(getSomeOrFail(rm().troubleTickets.getById(ticketId)).status).toBe(
      'In Progress'
    );
    const updates = buildChangeLog(
      rm().troubleTickets.getChangeLog([ticketId]),
      rm()
    ).filter(entry => entry.summary === 'posted an update');
    expect(updates).toMatchObject([
      {
        actor: 'Olu Owner',
        status: 'In Progress',
        details: [{label: 'Update', value: "I've ordered a new blade."}],
      },
      {
        actor: 'Olu Owner',
        status: 'In Progress',
        details: [
          {
            label: 'Update',
            value: "Still waiting for the blade - it's stuck in customs.",
          },
        ],
      },
    ]);
  });

  it('can be posted on a parked ticket, which stays parked', async () => {
    await framework.commands.troubleTickets.park({
      ticketId,
      whyParked: 'Waiting for a part' as NonEmptyString,
      pathToResolution: 'Fit it' as NonEmptyString,
      intermediateActions: 'Sign on the machine' as NonEmptyString,
      actor: actorFor(OWNER),
    });
    await post('Part has shipped.');

    expect(getSomeOrFail(rm().troubleTickets.getById(ticketId)).status).toBe(
      'Parked'
    );
  });

  it('refuses an update on a resolved ticket', async () => {
    await framework.commands.troubleTickets.resolve({
      ticketId,
      summary: 'New blade fitted' as NonEmptyString,
      quiet: false,
      actor: actorFor(OWNER),
    });
    const failure = getLeftOrFail(
      await postUpdate.process({
        command: {
          ticketId,
          update: 'One more thing' as NonEmptyString,
          actor: actorFor(OWNER),
        },
        rm: rm(),
      })()
    );
    expect(failure.status).toBe(StatusCodes.BAD_REQUEST);
  });

  it('refuses an update on a ticket that does not exist', async () => {
    const failure = getLeftOrFail(
      await postUpdate.process({
        command: {
          ticketId: faker.string.uuid() as UUID,
          update: 'Hello' as NonEmptyString,
          actor: actorFor(OWNER),
        },
        rm: rm(),
      })()
    );
    expect(failure.status).toBe(StatusCodes.NOT_FOUND);
  });

  it('tells the submitter what the update says', () => {
    expect(happeningOfEvent('TroubleTicketUpdatePosted')).toEqual(
      O.some('updated')
    );
    expect(
      describeTicketChange(
        {type: 'TroubleTicketUpdatePosted', update: 'Part ordered.'},
        'Olu Owner'
      )
    ).toBe('Olu Owner posted an update on this ticket.\n\nPart ordered.');
  });
});
