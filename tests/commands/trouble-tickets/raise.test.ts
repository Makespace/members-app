import * as O from 'fp-ts/Option';
import * as E from 'fp-ts/Either';
import {faker} from '@faker-js/faker';
import {UUID} from 'io-ts-types';
import {constructEvent} from '../../../src/types';
import {EmailAddress} from '../../../src/types/email-address';
import {UserActor} from '../../../src/types/actor';
import {getTaskEitherRightOrFail, systemActor} from '../../helpers';
import {raise} from '../../../src/commands/trouble-tickets/raise';
import {
  TestFramework,
  initTestFramework,
} from '../../read-models/test-framework';

const MEMBER = 77;

const memberActor: UserActor = {
  tag: 'user',
  user: {emailAddress: 'member@test.com' as EmailAddress, memberNumber: MEMBER},
};

describe('raising a trouble ticket in the app', () => {
  let framework: TestFramework;
  let equipmentId: UUID;

  beforeEach(async () => {
    framework = await initTestFramework();
    const areaId = faker.string.uuid() as UUID;
    equipmentId = faker.string.uuid() as UUID;
    const insert = framework.insertIntoSharedReadModel;
    insert(
      constructEvent('AreaCreated')({
        actor: systemActor(),
        id: areaId,
        name: 'Wood Shop',
      })
    );
    insert(
      constructEvent('EquipmentAdded')({
        actor: systemActor(),
        category: 'red',
        id: equipmentId,
        name: 'Bandsaw',
        areaId,
      })
    );
    insert(
      constructEvent('MemberNumberLinkedToEmail')({
        actor: systemActor(),
        memberNumber: MEMBER,
        email: 'member@test.com' as EmailAddress,
        name: 'Mem Ber',
        formOfAddress: undefined,
      })
    );
  });

  afterEach(() => {
    framework.close();
  });

  const input = (overrides: Record<string, unknown> = {}) => ({
    equipmentId,
    machine: '',
    otherEquipmentDetail: '',
    machineStatuses: ["It's not working"],
    attempting: 'Cutting 18mm ply',
    issue: 'Blade stalls halfway through a cut',
    steps: 'Checked the tension',
    ...overrides,
  });

  describe('what it records', () => {
    it('links the picked equipment directly, with no name to resolve', async () => {
      const result = await getTaskEitherRightOrFail(
        raise.process({
          command: {...input(), actor: memberActor},
          rm: framework.sharedReadModel,
        })
      );
      expect(O.toNullable(result)).toEqual(
        expect.objectContaining({
          type: 'TroubleTicketCreated',
          equipmentId,
          submittedEquipment: 'Bandsaw',
          source: 'app',
          submittedMemberNumber: MEMBER,
          submittedEmail: 'member@test.com',
          issue: 'Blade stalls halfway through a cut',
        })
      );
    });

    it('joins the machine statuses into the ticket status', async () => {
      const result = await getTaskEitherRightOrFail(
        raise.process({
          command: {
            ...input({
              machineStatuses: ["It's not working", 'It is unsafe'],
            }),
            actor: memberActor,
          },
          rm: framework.sharedReadModel,
        })
      );
      expect(O.toNullable(result)).toEqual(
        expect.objectContaining({status: "It's not working, It is unsafe"})
      );
    });

    it('records which unit, for equipment standing for several machines', async () => {
      const result = await getTaskEitherRightOrFail(
        raise.process({
          command: {...input({machine: 'Printer 2'}), actor: memberActor},
          rm: framework.sharedReadModel,
        })
      );
      expect(O.toNullable(result)).toEqual(
        expect.objectContaining({machine: 'Printer 2'})
      );
    });

    it('accepts equipment that is not listed, described in free text', async () => {
      const result = await getTaskEitherRightOrFail(
        raise.process({
          command: {
            ...input({
              equipmentId: '',
              otherEquipmentDetail: 'The vice by the door',
            }),
            actor: memberActor,
          },
          rm: framework.sharedReadModel,
        })
      );
      expect(O.toNullable(result)).toEqual(
        expect.objectContaining({
          equipmentId: null,
          submittedEquipment: null,
          otherEquipmentDetail: 'The vice by the door',
        })
      );
    });
  });

  describe('what it refuses', () => {
    it('needs to know what went wrong', () => {
      expect(E.isLeft(raise.decode(input({issue: ''})))).toBe(true);
      expect(E.isLeft(raise.decode(input({issue: '   '})))).toBe(true);
    });

    it('needs a machine: either picked, or described', () => {
      expect(
        E.isLeft(
          raise.decode(input({equipmentId: '', otherEquipmentDetail: ''}))
        )
      ).toBe(true);
    });

    it('tolerates the optional answers being left blank', () => {
      const decoded = raise.decode({
        equipmentId,
        issue: 'It broke',
        attempting: '',
      });
      expect(E.isRight(decoded)).toBe(true);
      expect(E.isRight(decoded) && decoded.right.machineStatuses).toEqual([]);
    });

    it('rejects equipment that does not exist', async () => {
      const result = await raise.process({
        command: {
          ...input({equipmentId: faker.string.uuid() as UUID}),
          actor: memberActor,
        },
        rm: framework.sharedReadModel,
      })();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  it('is open to any logged-in member, not just owners', () => {
    expect(
      raise.isAuthorized({
        actor: memberActor,
        rm: framework.sharedReadModel,
        input: input(),
      })
    ).toBe(true);
    expect(
      raise.isAuthorized({
        actor: systemActor(),
        rm: framework.sharedReadModel,
        input: input(),
      })
    ).toBe(false);
  });
});
