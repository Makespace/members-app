import * as O from 'fp-ts/Option';
import {getDetails} from '../../../src/read-models/members/get-via-shared-state';
import {EmailAddress} from '../../../src/types';
import {TestFramework, initTestFramework} from '../test-framework';
import {faker} from '@faker-js/faker';
import {getSomeOrFail} from '../../helpers';
import {pipe} from 'fp-ts/lib/function';

describe('get', () => {
  let framework: TestFramework;
  beforeEach(async () => {
    framework = await initTestFramework();
  });

  const memberNumber = faker.number.int();
  const runQuery = async () => {
    const events = await framework.getAllEvents();
    return pipe(events, getDetails(memberNumber), getSomeOrFail);
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

    it('returns member number and email', async () => {
      const result = await runQuery();
      expect(result.memberNumber).toEqual(memberNumber);
      expect(result.emailAddress).toEqual('foo@example.com');
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

      it.failing('returns latest details', async () => {
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

      it.todo('returns a record of previous emails');
    });

    describe('and they have been declared a super user', () => {
      it.todo('they are a superuser');
      describe('and when their superuser status has been revoked', () => {
        it.todo('they are no longer a superuser');
      });
    });
  });
});
