import {faker} from '@faker-js/faker';
import * as O from 'fp-ts/Option';
import * as E from 'fp-ts/Either';
import {StatusCodes} from 'http-status-codes';
import {NonEmptyString, UUID} from 'io-ts-types';
import {constructEvent} from '../../../src/types';
import {EmailAddress} from '../../../src/types/email-address';
import {UserActor} from '../../../src/types/actor';
import {
  getLeftOrFail,
  getTaskEitherRightOrFail,
  systemActor,
} from '../../helpers';
import {assign} from '../../../src/commands/trouble-tickets/assign';
import {resolve} from '../../../src/commands/trouble-tickets/resolve';
import {park} from '../../../src/commands/trouble-tickets/park';
import {needsHelp} from '../../../src/commands/trouble-tickets/needs-help';
import {setEquipment} from '../../../src/commands/trouble-tickets/set-equipment';
import {editTitle} from '../../../src/commands/trouble-tickets/edit-title';
import {TestFramework, initTestFramework} from '../../read-models/test-framework';

const TRAINER = 12;
const OUTSIDER = 99;

const userActorWithMember = (memberNumber: number): UserActor => ({
  tag: 'user',
  user: {
    emailAddress: `member${memberNumber}@test.com` as EmailAddress,
    memberNumber,
  },
});

describe('trouble ticket commands', () => {
  let framework: TestFramework;
  let ticketId: UUID;
  let equipmentId: UUID;

  beforeEach(async () => {
    framework = await initTestFramework();
    const areaId = faker.string.uuid() as UUID;
    equipmentId = faker.string.uuid() as UUID;
    ticketId = faker.string.uuid() as UUID;

    const insert = framework.insertIntoSharedReadModel;
    insert(
      constructEvent('AreaCreated')({actor: systemActor(), id: areaId, name: 'Area'})
    );
    insert(
      constructEvent('EquipmentAdded')({
        actor: systemActor(),
        id: equipmentId,
        name: 'Test Rig',
        areaId,
      })
    );
    insert(
      constructEvent('MemberNumberLinkedToEmail')({
        actor: systemActor(),
        memberNumber: TRAINER,
        email: 'trainer@test.com' as EmailAddress,
        name: undefined,
        formOfAddress: undefined,
      })
    );
    insert(
      constructEvent('OwnerAdded')({
        actor: systemActor(),
        areaId,
        memberNumber: TRAINER,
      })
    );
    insert(
      constructEvent('TrainerAdded')({
        actor: systemActor(),
        equipmentId,
        memberNumber: TRAINER,
      })
    );
    // submittedEquipment matches the equipment name so it resolves to equipmentId.
    insert(
      constructEvent('TroubleTicketCreated')({
        actor: systemActor(),
        id: ticketId,
        rowHash: faker.string.hexadecimal({length: 64}),
        sheetId: 'sheet-1',
        submittedAt: faker.date.past(),
        submittedMemberNumber: null,
        submittedEmail: null,
        submittedName: null,
        submittedEquipment: 'Test Rig',
        otherEquipmentDetail: '',
        status: 'Broken',
        attempting: 'x',
        issue: 'the issue',
        steps: '',
      })
    );
  });

  afterEach(() => {
    framework.close();
  });

  const rm = () => framework.sharedReadModel;

  describe('assign', () => {
    it('authorises a trainer but not an outsider', () => {
      expect(
        assign.isAuthorized({
          actor: userActorWithMember(TRAINER),
          rm: rm(),
          input: {ticketId},
        })
      ).toBe(true);
      expect(
        assign.isAuthorized({
          actor: userActorWithMember(OUTSIDER),
          rm: rm(),
          input: {ticketId},
        })
      ).toBe(false);
    });

    it('emits TroubleTicketAssigned for the acting member', async () => {
      const result = await getTaskEitherRightOrFail(
        assign.process({
          command: {ticketId, actor: userActorWithMember(TRAINER)},
          rm: rm(),
        })
      );
      expect(result).toStrictEqual(
        O.some(
          expect.objectContaining({
            type: 'TroubleTicketAssigned',
            ticketId,
            trainerMemberNumber: TRAINER,
          })
        )
      );
    });

    it('is idempotent once assigned', async () => {
      framework.insertIntoSharedReadModel(
        constructEvent('TroubleTicketAssigned')({
          actor: userActorWithMember(TRAINER),
          ticketId,
          trainerMemberNumber: TRAINER,
        })
      );
      const result = await getTaskEitherRightOrFail(
        assign.process({
          command: {ticketId, actor: userActorWithMember(TRAINER)},
          rm: rm(),
        })
      );
      expect(result).toStrictEqual(O.none);
    });

    it('fails for an unknown ticket', async () => {
      const failure = getLeftOrFail(
        await assign.process({
          command: {
            ticketId: faker.string.uuid() as UUID,
            actor: userActorWithMember(TRAINER),
          },
          rm: rm(),
        })()
      );
      expect(failure.status).toStrictEqual(StatusCodes.NOT_FOUND);
    });
  });

  describe('resolve', () => {
    it('requires a non-empty summary', () => {
      expect(E.isLeft(resolve.decode({ticketId, summary: ''}))).toBe(true);
    });

    it('emits TroubleTicketResolved', async () => {
      const result = await getTaskEitherRightOrFail(
        resolve.process({
          command: {
            ticketId,
            summary: 'fixed it' as NonEmptyString,
            actor: userActorWithMember(TRAINER),
          },
          rm: rm(),
        })
      );
      expect(O.isSome(result)).toBe(true);
      expect(O.toNullable(result)).toEqual(
        expect.objectContaining({type: 'TroubleTicketResolved', summary: 'fixed it'})
      );
    });
  });

  describe('park', () => {
    it('emits TroubleTicketParked with all context', async () => {
      const result = await getTaskEitherRightOrFail(
        park.process({
          command: {
            ticketId,
            whyParked: 'awaiting part' as NonEmptyString,
            pathToResolution: 'order it' as NonEmptyString,
            intermediateActions: 'label it' as NonEmptyString,
            actor: userActorWithMember(TRAINER),
          },
          rm: rm(),
        })
      );
      expect(O.toNullable(result)).toEqual(
        expect.objectContaining({
          type: 'TroubleTicketParked',
          whyParked: 'awaiting part',
          pathToResolution: 'order it',
          intermediateActions: 'label it',
        })
      );
    });
  });

  describe('needsHelp', () => {
    it('emits TroubleTicketNeedsHelp', async () => {
      const result = await getTaskEitherRightOrFail(
        needsHelp.process({
          command: {
            ticketId,
            whatTried: 'reseated cable' as NonEmptyString,
            whyDidntWork: 'no power' as NonEmptyString,
            actor: userActorWithMember(TRAINER),
          },
          rm: rm(),
        })
      );
      expect(O.toNullable(result)).toEqual(
        expect.objectContaining({type: 'TroubleTicketNeedsHelp'})
      );
    });
  });

  describe('setEquipment', () => {
    it('authorises the owner of the equipment', () => {
      expect(
        setEquipment.isAuthorized({
          actor: userActorWithMember(TRAINER),
          rm: rm(),
          input: {ticketId, equipmentId},
        })
      ).toBe(true);
    });

    it('rejects an unknown equipment id', async () => {
      const failure = getLeftOrFail(
        await setEquipment.process({
          command: {
            ticketId,
            equipmentId: faker.string.uuid() as UUID,
            actor: userActorWithMember(TRAINER),
          },
          rm: rm(),
        })()
      );
      expect(failure.status).toStrictEqual(StatusCodes.BAD_REQUEST);
    });

    it('emits TroubleTicketEquipmentSet (including null to unassign)', async () => {
      const result = await getTaskEitherRightOrFail(
        setEquipment.process({
          command: {ticketId, equipmentId: null, actor: userActorWithMember(TRAINER)},
          rm: rm(),
        })
      );
      expect(O.toNullable(result)).toEqual(
        expect.objectContaining({type: 'TroubleTicketEquipmentSet', equipmentId: null})
      );
    });
  });

  describe('editTitle', () => {
    it('authorises the owner and emits TroubleTicketTitleEdited', async () => {
      expect(
        editTitle.isAuthorized({
          actor: userActorWithMember(TRAINER),
          rm: rm(),
          input: {ticketId, title: 'clearer title' as NonEmptyString},
        })
      ).toBe(true);
      const result = await getTaskEitherRightOrFail(
        editTitle.process({
          command: {
            ticketId,
            title: 'clearer title' as NonEmptyString,
            actor: userActorWithMember(TRAINER),
          },
          rm: rm(),
        })
      );
      expect(O.toNullable(result)).toEqual(
        expect.objectContaining({type: 'TroubleTicketTitleEdited', title: 'clearer title'})
      );
    });
  });
});
