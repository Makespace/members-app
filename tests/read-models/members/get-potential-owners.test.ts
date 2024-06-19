import {faker} from '@faker-js/faker';
import * as O from 'fp-ts/Option';
import {getPotentialOwners} from '../../../src/read-models/members/getPotentialOwners';
import {TestFramework, initTestFramework} from '../test-framework';
import {EmailAddress} from '../../../src/types';
import {NonEmptyString, UUID} from 'io-ts-types';
import {getSomeOrFail} from '../../helpers';
import {pipe} from 'fp-ts/lib/function';

describe('getPotentialOwners', () => {
  let framework: TestFramework;
  beforeEach(async () => {
    framework = await initTestFramework();
  });

  const callQuery = async (areaId: UUID) =>
    pipe(
      await framework.getAllEvents(),
      getPotentialOwners(areaId as string),
      getSomeOrFail
    );

  let result: Awaited<ReturnType<typeof callQuery>>;

  describe('when the area does not exist', () => {
    it('returns None', async () => {
      expect(
        getPotentialOwners(faker.string.uuid())(await framework.getAllEvents())
      ).toStrictEqual(O.none);
    });
  });

  const linkNumber = {
    email: faker.internet.email() as EmailAddress,
    memberNumber: faker.number.int(),
  };
  const addName = {
    name: faker.person.fullName(),
    memberNumber: linkNumber.memberNumber,
  };
  const createArea = {
    id: faker.string.uuid() as UUID,
    name: faker.company.buzzNoun() as NonEmptyString,
  };

  describe('when a member is already an owner of the area', () => {
    beforeEach(async () => {
      await framework.commands.memberNumbers.linkNumberToEmail(linkNumber);
      await framework.commands.area.create(createArea);
      await framework.commands.area.addOwner({
        memberNumber: linkNumber.memberNumber,
        areaId: createArea.id,
      });
      await framework.commands.members.editName(addName);
      result = await callQuery(createArea.id);
    });

    it('includes them in the existing owners', () => {
      expect(result.existing).toHaveLength(1);
      expect(result.potential).toHaveLength(0);
      expect(result.existing[0].number).toStrictEqual(linkNumber.memberNumber);
      expect(result.existing[0].name).toStrictEqual(O.some(addName.name));
    });
  });

  describe('when a member is not an owner of the area', () => {
    beforeEach(async () => {
      await framework.commands.memberNumbers.linkNumberToEmail(linkNumber);
      await framework.commands.members.editName(addName);
      await framework.commands.area.create(createArea);
      result = await callQuery(createArea.id);
    });

    it('includes them in the potential owners', () => {
      expect(result.existing).toHaveLength(0);
      expect(result.potential).toHaveLength(1);
      expect(result.potential[0].number).toStrictEqual(linkNumber.memberNumber);
      expect(result.potential[0].name).toStrictEqual(O.some(addName.name));
    });
  });

  describe('when a member has signed the owner agreement', () => {
    const signAgreement = {
      signedAt: faker.date.soon(),
      memberNumber: linkNumber.memberNumber,
    };
    beforeEach(async () => {
      await framework.commands.memberNumbers.linkNumberToEmail(linkNumber);
      await framework.commands.members.editName(addName);
      await framework.commands.members.signOwnerAgreement(signAgreement);
      await framework.commands.area.create(createArea);
      result = await callQuery(createArea.id);
    });

    it.failing('includes the date they signed', () => {
      expect(result.potential[0].agreementSigned).toStrictEqual(
        O.some(signAgreement)
      );
    });
  });
});
