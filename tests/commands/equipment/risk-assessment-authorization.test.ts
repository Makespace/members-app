import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';
import {setRiskAssessmentUrl} from '../../../src/commands/equipment/set-risk-assessment-url';
import {arbitraryUser} from '../../types/user.helper';
import {
  TestFramework,
  initTestFramework,
} from '../../read-models/test-framework';
import {Actor} from '../../../src/types/actor';
import {EmailAddress} from '../../../src/types';

// Who may say where a machine's risk assessment lives: the people responsible
// for the area it sits in, plus admins. Trainers teach on a machine but do not
// own it, so they are deliberately not included.
describe('who can record a risk assessment', () => {
  let framework: TestFramework;
  const equipmentId = faker.string.uuid() as UUID;
  const areaId = faker.string.uuid() as UUID;
  const owner = arbitraryUser();
  const trainer = arbitraryUser();
  const superUser = arbitraryUser();
  const stranger = arbitraryUser();

  const asUser = (user: {
    memberNumber: number;
    emailAddress: EmailAddress;
  }): Actor => ({
    tag: 'user',
    user: {
      memberNumber: user.memberNumber,
      emailAddress: user.emailAddress,
    },
  });

  const canSet = (actor: Actor) =>
    setRiskAssessmentUrl.isAuthorized({
      actor,
      rm: framework.sharedReadModel,
      input: {equipmentId, riskAssessmentUrl: 'https://example.com/ra'},
    });

  beforeEach(async () => {
    framework = await initTestFramework();
    for (const user of [owner, trainer, superUser, stranger]) {
      await framework.commands.memberNumbers.linkNumberToEmail({
        memberNumber: user.memberNumber,
        email: user.emailAddress,
        name: undefined,
        formOfAddress: undefined,
      });
    }
    await framework.commands.superUser.declare({
      memberNumber: superUser.memberNumber,
    });
    await framework.commands.area.create({
      id: areaId,
      name: faker.company.buzzNoun() as NonEmptyString,
    });
    await framework.commands.equipment.add({
      id: equipmentId,
      name: faker.company.buzzNoun() as NonEmptyString,
      areaId,
    });
    await framework.commands.area.addOwner({
      areaId,
      memberNumber: owner.memberNumber,
    });
    await framework.commands.trainers.add({
      equipmentId,
      memberNumber: trainer.memberNumber,
    });
  });
  afterEach(() => framework.close());

  it('lets an owner of the area record it', () => {
    expect(canSet(asUser(owner))).toBe(true);
  });

  it('lets a super user record it', () => {
    expect(canSet(asUser(superUser))).toBe(true);
  });

  it('lets an admin token record it', () => {
    expect(canSet({tag: 'token', token: 'admin'})).toBe(true);
  });

  it('does not let a trainer record it', () => {
    expect(canSet(asUser(trainer))).toBe(false);
  });

  it('does not let any other member record it', () => {
    expect(canSet(asUser(stranger))).toBe(false);
  });
});
