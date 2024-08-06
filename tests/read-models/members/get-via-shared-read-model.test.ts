import * as O from 'fp-ts/Option';
import {getDetails} from '../../../src/read-models/members/get';
import {EmailAddress} from '../../../src/types';
import {TestFramework, initTestFramework} from '../test-framework';
import {faker} from '@faker-js/faker';
import {getSomeOrFail} from '../../helpers';
import {pipe} from 'fp-ts/lib/function';
import {gravatarHashFromEmail} from '../../../src/read-models/members/avatar';
import {NonEmptyString, UUID} from 'io-ts-types';
import {Int} from 'io-ts';

describe('get-via-shared-read-model', () => {
  let framework: TestFramework;
  beforeEach(async () => {
    framework = await initTestFramework();
  });

  const memberNumber = faker.number.int();
  const runQuery = async () => {
    const events = await framework.getAllEvents();
    framework.sharedReadModel.refresh(events);
    return pipe(
      memberNumber,
      framework.sharedReadModel.members.get,
      getSomeOrFail
    );
  };

  describe('when the member does not exist', () => {
    it('returns none', async () => {
      const events = await framework.getAllEvents();
      const result = getDetails(memberNumber)(events);
      expect(result).toStrictEqual(O.none);
    });
  });

  describe('when the member exists', () => {
    beforeEach(async () => {
      await framework.commands.memberNumbers.linkNumberToEmail({
        memberNumber,
        email: 'foo@example.com' as EmailAddress,
      });
    });

    it('returns member number, email and gravatar hash', async () => {
      const result = await runQuery();
      expect(result.memberNumber).toEqual(memberNumber);
      expect(result.emailAddress).toEqual('foo@example.com');
      expect(result.gravatarHash).toStrictEqual(
        gravatarHashFromEmail('foo@example.com')
      );
    });

    describe('and their name has been recorded', () => {
      const name = faker.person.fullName();
      beforeEach(async () => {
        await framework.commands.members.editName({
          memberNumber,
          name,
        });
      });

      it('returns their name', async () => {
        const result = await runQuery();
        expect(result.name).toStrictEqual(O.some(name));
      });
    });

    describe('and their details have changed multiple times', () => {
      beforeEach(async () => {
        await framework.commands.members.editName({
          memberNumber,
          name: 'Ix',
        });
        await framework.commands.members.editPronouns({
          memberNumber,
          pronouns: 'he/him',
        });
        await framework.commands.members.editName({
          memberNumber,
          name: 'Ford Prefect',
        });
      });

      it('returns latest details', async () => {
        const result = await runQuery();
        expect(result.name).toStrictEqual(O.some('Ford Prefect'));
        expect(result.pronouns).toStrictEqual(O.some('he/him'));
      });
    });

    describe('and their email has changed', () => {
      beforeEach(async () => {
        await framework.commands.members.editEmail({
          memberNumber,
          email: 'updated@example.com' as EmailAddress,
        });
      });

      it.failing('returns the latest email', async () => {
        const result = await runQuery();
        expect(result.emailAddress).toBe('updated@example.com');
      });

      it.failing('returns a record of previous emails', async () => {
        const result = await runQuery();
        expect(result.prevEmails).toHaveLength(1);
        expect(result.prevEmails[0]).toStrictEqual('foo@example.com');
      });

      it.failing('returns gravatar hash based on latest email', async () => {
        const result = await runQuery();
        expect(result.gravatarHash).toStrictEqual(
          gravatarHashFromEmail('updated@example.com')
        );
      });
    });

    describe('and they have been declared a super user', () => {
      beforeEach(async () => {
        await framework.commands.superUser.declare({
          memberNumber,
        });
      });

      it.failing('they are a superuser', async () => {
        const result = await runQuery();
        expect(result.isSuperUser).toBe(true);
      });

      describe('and when their superuser status has been revoked', () => {
        beforeEach(async () => {
          await framework.commands.superUser.revoke({
            memberNumber,
          });
        });

        it('they are no longer a superuser', async () => {
          const result = await runQuery();
          expect(result.isSuperUser).toBe(false);
        });
      });
    });

    describe('and they have been trained', () => {
      const createArea = {
        name: faker.company.buzzNoun() as NonEmptyString,
        id: faker.string.uuid() as UUID,
      };
      const createEquipment = {
        name: faker.company.buzzNoun() as NonEmptyString,
        id: faker.string.uuid() as UUID,
        areaId: createArea.id,
      };
      beforeEach(async () => {
        await framework.commands.area.create(createArea);
        await framework.commands.equipment.add(createEquipment);
        await framework.commands.trainers.markTrained({
          memberNumber: memberNumber as Int,
          equipmentId: createEquipment.id,
        });
      });

      it.failing('returns the equipment name and id', async () => {
        const result = await runQuery();
        expect(result.trainedOn).toHaveLength(1);
        expect(result.trainedOn[0].id).toStrictEqual(createEquipment.id);
      });

      it.todo('returns date they were marked as trained');
    });
  });
});
