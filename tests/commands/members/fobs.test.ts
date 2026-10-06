import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {recordFob} from '../../../src/commands/members/record-fob';
import {removeFob} from '../../../src/commands/members/remove-fob';
import {NonEmptyString} from 'io-ts-types';
import {EmailAddress} from '../../../src/types';
import {
  arbitraryActor,
  getLeftOrFail,
  getRightOrFail,
  getSomeOrFail,
  getTaskEitherRightOrFail,
  userActor,
} from '../../helpers';
import {TestFramework, initTestFramework} from '../../read-models/test-framework';

describe('member fob commands', () => {
  let framework: TestFramework;
  const memberNumber = faker.number.int({min: 1, max: 100_000});

  beforeEach(async () => {
    framework = await initTestFramework();
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber,
      email: faker.internet.email() as EmailAddress,
      name: undefined,
      formOfAddress: undefined,
    });
  });

  afterEach(() => {
    framework.close();
  });

  const fob = {
    memberNumber,
    fobId: 4321,
    accessLevel: 'Member' as NonEmptyString,
    paxtonName: 'Molly 1337 Millions' as NonEmptyString,
  };

  describe('record-fob', () => {
    it('decodes the form fields, which arrive as strings', () => {
      expect(
        getRightOrFail(
          recordFob.decode({
            memberNumber: String(memberNumber),
            fobId: '4321',
            accessLevel: 'Member',
            paxtonName: 'Molly 1337 Millions',
          })
        )
      ).toStrictEqual(fob);
    });

    it('rejects an empty access level', () => {
      getLeftOrFail(
        recordFob.decode({
          memberNumber: String(memberNumber),
          fobId: '4321',
          accessLevel: '',
          paxtonName: 'Molly',
        })
      );
    });

    it('fails for an unknown member', async () => {
      getLeftOrFail(
        await recordFob.process({
          command: {...fob, memberNumber: memberNumber + 1, actor: arbitraryActor()},
          rm: framework.sharedReadModel,
        })()
      );
    });

    it('produces a MemberFobRecorded event', async () => {
      const result = getSomeOrFail(
        await getTaskEitherRightOrFail(
          recordFob.process({
            command: {...fob, actor: arbitraryActor()},
            rm: framework.sharedReadModel,
          })
        )
      );
      expect(result).toMatchObject({type: 'MemberFobRecorded', ...fob});
    });

    it('produces nothing when the fob is already recorded as-is', async () => {
      await framework.commands.members.recordFob(fob);
      const result = await getTaskEitherRightOrFail(
        recordFob.process({
          command: {...fob, actor: arbitraryActor()},
          rm: framework.sharedReadModel,
        })
      );
      expect(result).toStrictEqual(O.none);
    });

    it('produces an event when a recorded fob changes access level', async () => {
      await framework.commands.members.recordFob(fob);
      const result = getSomeOrFail(
        await getTaskEitherRightOrFail(
          recordFob.process({
            command: {...fob, accessLevel: 'Owner' as NonEmptyString, actor: arbitraryActor()},
            rm: framework.sharedReadModel,
          })
        )
      );
      expect(result).toMatchObject({accessLevel: 'Owner'});
    });

    describe('authorization', () => {
      const isAuthorized = (actor: Parameters<typeof recordFob.isAuthorized>[0]['actor']) =>
        recordFob.isAuthorized({
          actor,
          rm: framework.sharedReadModel,
          input: fob,
        });

      it('allows the admin token', () => {
        expect(isAuthorized(arbitraryActor())).toBe(true);
      });

      it('refuses the member themselves', () => {
        const self = userActor();
        expect(
          isAuthorized({...self, user: {...self.user, memberNumber}})
        ).toBe(false);
      });

      it('allows a super user', async () => {
        const superUserNumber = memberNumber + 1;
        await framework.commands.memberNumbers.linkNumberToEmail({
          memberNumber: superUserNumber,
          email: faker.internet.email() as EmailAddress,
          name: undefined,
          formOfAddress: undefined,
        });
        await framework.commands.superUser.declare({
          memberNumber: superUserNumber,
        });
        const viewer = userActor();
        expect(
          isAuthorized({
            ...viewer,
            user: {...viewer.user, memberNumber: superUserNumber},
          })
        ).toBe(true);
      });
    });
  });

  describe('remove-fob', () => {
    it('produces a MemberFobRemoved event for a recorded fob', async () => {
      await framework.commands.members.recordFob(fob);
      const result = getSomeOrFail(
        await getTaskEitherRightOrFail(
          removeFob.process({
            command: {memberNumber, fobId: fob.fobId, actor: arbitraryActor()},
            rm: framework.sharedReadModel,
          })
        )
      );
      expect(result).toMatchObject({
        type: 'MemberFobRemoved',
        memberNumber,
        fobId: fob.fobId,
      });
    });

    it('produces nothing for a fob the member does not hold', async () => {
      const result = await getTaskEitherRightOrFail(
        removeFob.process({
          command: {memberNumber, fobId: 999, actor: arbitraryActor()},
          rm: framework.sharedReadModel,
        })
      );
      expect(result).toStrictEqual(O.none);
    });

    it('refuses the member themselves', () => {
      const self = userActor();
      expect(
        removeFob.isAuthorized({
          actor: {...self, user: {...self.user, memberNumber}},
          rm: framework.sharedReadModel,
          input: {memberNumber, fobId: fob.fobId},
        })
      ).toBe(false);
    });
  });
});
