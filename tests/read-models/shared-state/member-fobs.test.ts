import {faker} from '@faker-js/faker';
import {Int} from 'io-ts';
import {NonEmptyString} from 'io-ts-types';
import {EmailAddress, User} from '../../../src/types';
import {getSomeOrFail} from '../../helpers';
import {TestFramework, initTestFramework} from '../test-framework';

const member = 'Member' as NonEmptyString;
const owner = 'Owner' as NonEmptyString;
const molly = 'Molly' as NonEmptyString;

describe('member fob projection', () => {
  let framework: TestFramework;
  let memberNumber: number;

  beforeEach(async () => {
    framework = await initTestFramework();
    memberNumber = faker.number.int({min: 1, max: 100_000});
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber,
      email: faker.internet.email() as EmailAddress,
      name: undefined,
      formOfAddress: undefined,
    });
  });

  afterEach(() => {
    framework?.close();
  });

  const getFobs = (number: number) =>
    getSomeOrFail(framework.sharedReadModel.members.getByMemberNumber(number))
      .fobs;

  it('has no fobs until one is recorded', () => {
    expect(getFobs(memberNumber)).toStrictEqual([]);
  });

  it('records a fob with its access level and Paxton name', async () => {
    await framework.commands.members.recordFob({
      memberNumber,
      fobId: 4321,
      accessLevel: member,
      paxtonName: 'Molly 1337 Millions' as NonEmptyString,
    });

    const fobs = getFobs(memberNumber);
    expect(fobs).toHaveLength(1);
    expect(fobs[0]).toMatchObject({
      fobId: 4321,
      accessLevel: member,
      paxtonName: 'Molly 1337 Millions' as NonEmptyString,
    });
    expect(fobs[0].recordedAt).toBeInstanceOf(Date);
  });

  it('a member can hold several fobs', async () => {
    await framework.commands.members.recordFob({
      memberNumber,
      fobId: 1,
      accessLevel: member,
      paxtonName: molly,
    });
    await framework.commands.members.recordFob({
      memberNumber,
      fobId: 2,
      accessLevel: owner,
      paxtonName: molly,
    });

    expect(getFobs(memberNumber).map(fob => fob.fobId).sort()).toStrictEqual([
      1, 2,
    ]);
  });

  it('recording a known fob again updates its access level', async () => {
    await framework.commands.members.recordFob({
      memberNumber,
      fobId: 7,
      accessLevel: member,
      paxtonName: molly,
    });
    await framework.commands.members.recordFob({
      memberNumber,
      fobId: 7,
      accessLevel: owner,
      paxtonName: molly,
    });

    const fobs = getFobs(memberNumber);
    expect(fobs).toHaveLength(1);
    expect(fobs[0].accessLevel).toStrictEqual('Owner');
  });

  it('a fob recorded against another member moves to them', async () => {
    const otherMemberNumber = memberNumber + 1;
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: otherMemberNumber,
      email: faker.internet.email() as EmailAddress,
      name: undefined,
      formOfAddress: undefined,
    });
    await framework.commands.members.recordFob({
      memberNumber,
      fobId: 7,
      accessLevel: member,
      paxtonName: molly,
    });
    await framework.commands.members.recordFob({
      memberNumber: otherMemberNumber,
      fobId: 7,
      accessLevel: member,
      paxtonName: 'Case' as NonEmptyString,
    });

    expect(getFobs(memberNumber)).toStrictEqual([]);
    expect(getFobs(otherMemberNumber).map(fob => fob.fobId)).toStrictEqual([
      7,
    ]);
  });

  it('removes a fob', async () => {
    await framework.commands.members.recordFob({
      memberNumber,
      fobId: 7,
      accessLevel: member,
      paxtonName: molly,
    });
    await framework.commands.members.recordFob({
      memberNumber,
      fobId: 8,
      accessLevel: member,
      paxtonName: molly,
    });
    await framework.commands.members.removeFob({memberNumber, fobId: 7});

    expect(getFobs(memberNumber).map(fob => fob.fobId)).toStrictEqual([8]);
  });

  it('keeps fobs when member numbers are merged', async () => {
    const oldMemberNumber = faker.number.int({min: 1, max: 1000}) as Int;
    const newMemberNumber = faker.number.int({
      min: oldMemberNumber + 1,
      max: 100_000,
    }) as Int;
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: oldMemberNumber,
      email: faker.internet.email() as EmailAddress,
      name: undefined,
      formOfAddress: undefined,
    });
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: newMemberNumber,
      email: faker.internet.email() as EmailAddress,
      name: undefined,
      formOfAddress: undefined,
    });
    await framework.commands.members.recordFob({
      memberNumber: oldMemberNumber,
      fobId: 10,
      accessLevel: member,
      paxtonName: molly,
    });
    await framework.commands.members.recordFob({
      memberNumber: newMemberNumber,
      fobId: 11,
      accessLevel: member,
      paxtonName: molly,
    });
    await framework.commands.memberNumbers.markMemberRejoinedWithNewNumber({
      oldMemberNumber,
      newMemberNumber,
      carryOverTraining: true,
    });

    expect(
      getFobs(oldMemberNumber)
        .map(fob => fob.fobId)
        .sort()
    ).toStrictEqual([10, 11]);
  });

  describe('visibility', () => {
    beforeEach(async () => {
      await framework.commands.members.recordFob({
        memberNumber,
        fobId: 7,
        accessLevel: member,
        paxtonName: molly,
      });
    });

    const viewedBy = (viewer: User) =>
      getSomeOrFail(
        framework.sharedReadModel.members.getAsActor(viewer)(memberNumber)
      );

    const userWithNumber = (number: number): User => ({
      memberNumber: number,
      emailAddress: faker.internet.email() as EmailAddress,
    });

    it('a super user sees them', async () => {
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

      expect(viewedBy(userWithNumber(superUserNumber)).fobs).toHaveLength(1);
    });

    it('the member themselves does not', () => {
      expect(viewedBy(userWithNumber(memberNumber)).fobs).toStrictEqual([]);
    });

    it('another ordinary member does not', () => {
      expect(viewedBy(userWithNumber(memberNumber + 2)).fobs).toStrictEqual(
        []
      );
    });

    it('still shows the member their own email', () => {
      expect(viewedBy(userWithNumber(memberNumber)).primaryEmailAddress).not.toStrictEqual(
        '******'
      );
    });
  });
});
