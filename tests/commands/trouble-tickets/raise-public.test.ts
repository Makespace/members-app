import * as O from 'fp-ts/Option';
import * as E from 'fp-ts/Either';
import {faker} from '@faker-js/faker';
import {UUID} from 'io-ts-types';
import {constructEvent} from '../../../src/types';
import {EmailAddress} from '../../../src/types/email-address';
import {Actor} from '../../../src/types/actor';
import {getRightOrFail, getTaskEitherRightOrFail, systemActor} from '../../helpers';
import {raisePublic} from '../../../src/commands/trouble-tickets/raise-public';
import {
  TestFramework,
  initTestFramework,
} from '../../read-models/test-framework';

const MEMBER = 77;
const publicActor: Actor = {tag: 'public'};

describe('raising a trouble ticket without logging in', () => {
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

  // What the form posts.
  const posted = (overrides: Record<string, unknown> = {}) => ({
    equipmentId,
    machine: '',
    otherEquipmentDetail: '',
    machineStatuses: "It's not working",
    attempting: '',
    issue: 'Blade stalls halfway through a cut',
    steps: '',
    reporterName: '',
    reporterEmail: '',
    reporterMemberNumber: '',
    ...overrides,
  });

  const raised = async (overrides: Record<string, unknown> = {}) =>
    O.toNullable(
      await getTaskEitherRightOrFail(
        raisePublic.process({
          command: {
            ...getRightOrFail(raisePublic.decode(posted(overrides))),
            actor: publicActor,
          },
          rm: framework.sharedReadModel,
        })
      )
    );

  describe('working out who it is from', () => {
    it("puts it on the account whose email address they gave", async () => {
      expect(
        await raised({reporterEmail: 'member@test.com'})
      ).toEqual(
        expect.objectContaining({
          source: 'public',
          submittedMemberNumber: MEMBER,
          submittedEmail: 'member@test.com',
          providedMemberNumber: null,
          // Nobody typed a name, so the account's is used.
          submittedName: 'Mem Ber',
        })
      );
    });

    it('matches the address however it is capitalised', async () => {
      expect(await raised({reporterEmail: 'Member@Test.com'})).toEqual(
        expect.objectContaining({submittedMemberNumber: MEMBER})
      );
    });

    // Typing a number proves nothing - anybody can type anybody's - so the
    // ticket is not put on that account. The emailed link does that.
    it('keeps a member number on its own as what they said, not whose it is', async () => {
      expect(
        await raised({
          reporterEmail: 'personal@elsewhere.com',
          reporterMemberNumber: String(MEMBER),
        })
      ).toEqual(
        expect.objectContaining({
          submittedMemberNumber: null,
          providedMemberNumber: MEMBER,
          submittedEmail: 'personal@elsewhere.com',
        })
      );
    });

    it('keeps a number that disagrees with the account, for the owners to see', async () => {
      expect(
        await raised({
          reporterEmail: 'member@test.com',
          reporterMemberNumber: '1234',
        })
      ).toEqual(
        expect.objectContaining({
          submittedMemberNumber: MEMBER,
          providedMemberNumber: 1234,
        })
      );
    });

    it('takes a report from somebody who gives nothing about themselves', async () => {
      expect(await raised()).toEqual(
        expect.objectContaining({
          submittedMemberNumber: null,
          providedMemberNumber: null,
          submittedEmail: null,
          submittedName: '',
          equipmentId,
        })
      );
    });
  });

  describe('what it refuses', () => {
    it('an email address that is not one', () => {
      expect(
        E.isLeft(raisePublic.decode(posted({reporterEmail: 'not an email'})))
      ).toBe(true);
    });

    it('a member number that is not a number', () => {
      expect(
        E.isLeft(
          raisePublic.decode(posted({reporterMemberNumber: 'seventy-seven'}))
        )
      ).toBe(true);
    });

    it('a report with nothing about what went wrong', () => {
      expect(E.isLeft(raisePublic.decode(posted({issue: '  '})))).toBe(true);
    });

    // A logged-in member reports through the member form, which puts it on
    // their account; they should not be able to come in as a stranger.
    it('anybody but somebody not logged in', () => {
      expect(
        raisePublic.isAuthorized({
          actor: systemActor(),
          rm: framework.sharedReadModel,
          input: getRightOrFail(raisePublic.decode(posted())),
        })
      ).toBe(false);
    });
  });
});
