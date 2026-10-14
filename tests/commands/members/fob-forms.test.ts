import {faker} from '@faker-js/faker';
import {Int} from 'io-ts';
import {NonEmptyString} from 'io-ts-types';
import {StatusCodes} from 'http-status-codes';
import {recordFobForm} from '../../../src/commands/members/record-fob-form';
import {removeFobForm} from '../../../src/commands/members/remove-fob-form';
import {EmailAddress} from '../../../src/types';
import {getLeftOrFail, getRightOrFail} from '../../helpers';
import {initTestFramework, TestFramework} from '../../read-models/test-framework';
import {arbitraryUser} from '../../types/user.helper';

describe('fob forms', () => {
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
    await framework.commands.members.recordFob({
      memberNumber,
      fobId: 7 as Int,
      accessLevel: 'Member' as NonEmptyString,
      paxtonName: 'Molly' as NonEmptyString,
    });
  });

  afterEach(() => {
    framework.close();
  });

  const context = () => ({
    user: arbitraryUser(),
    deps: framework.depsForCommands,
    readModel: framework.sharedReadModel,
  });

  describe('record-fob', () => {
    it('builds for an existing member', async () => {
      const viewModel = getRightOrFail(
        await recordFobForm.constructForm({member: String(memberNumber)})(
          context()
        )()
      );
      expect(viewModel.memberNumber).toStrictEqual(memberNumber);
    });

    it('is not found for an unknown member', async () => {
      const failure = getLeftOrFail(
        await recordFobForm.constructForm({member: String(memberNumber + 1)})(
          context()
        )()
      );
      expect(failure.status).toStrictEqual(StatusCodes.NOT_FOUND);
    });
  });

  describe('remove-fob', () => {
    it('builds for a fob the member holds', async () => {
      const viewModel = getRightOrFail(
        await removeFobForm.constructForm({
          member: String(memberNumber),
          fob: '7',
        })(context())()
      );
      expect(viewModel).toMatchObject({memberNumber, fobId: 7});
    });

    it('is not found for a fob the member does not hold', async () => {
      const failure = getLeftOrFail(
        await removeFobForm.constructForm({
          member: String(memberNumber),
          fob: '8',
        })(context())()
      );
      expect(failure.status).toStrictEqual(StatusCodes.NOT_FOUND);
    });

    it('is not found for an unknown member', async () => {
      const failure = getLeftOrFail(
        await removeFobForm.constructForm({
          member: String(memberNumber + 1),
          fob: '7',
        })(context())()
      );
      expect(failure.status).toStrictEqual(StatusCodes.NOT_FOUND);
    });
  });
});
