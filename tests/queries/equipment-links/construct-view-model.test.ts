import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';
import {arbitraryUser} from '../../types/user.helper';
import {getLeftOrFail, getRightOrFail} from '../../helpers';
import {
  initTestFramework,
  TestFramework,
} from '../../read-models/test-framework';
import {constructViewModel} from '../../../src/queries/equipment-links/construct-view-model';

describe('the equipment guides and risk assessments page', () => {
  let framework: TestFramework;
  const superUser = arbitraryUser();
  const ordinaryUser = arbitraryUser();
  const areaId = faker.string.uuid() as UUID;
  const withBoth = faker.string.uuid() as UUID;
  const guideOnly = faker.string.uuid() as UUID;
  const neither = faker.string.uuid() as UUID;

  beforeEach(async () => {
    framework = await initTestFramework();
    for (const user of [superUser, ordinaryUser]) {
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
      name: 'Wood Shop' as NonEmptyString,
    });
    for (const [id, name] of [
      [withBoth, 'Band Saw'],
      [guideOnly, 'Belt Sander'],
      [neither, 'Chop Saw'],
    ] as const) {
      await framework.commands.equipment.add({
        id,
        name: name as NonEmptyString,
        areaId,
      });
    }
    await framework.commands.equipment.setGuideUrl({
      equipmentId: withBoth,
      guideUrl: 'https://equipment.makespace.org/wood-shop/band-saw',
    });
    await framework.commands.equipment.setRiskAssessmentUrl({
      equipmentId: withBoth,
      riskAssessmentUrl: 'https://example.com/ra',
    });
    await framework.commands.equipment.setGuideUrl({
      equipmentId: guideOnly,
      guideUrl: 'https://equipment.makespace.org/wood-shop/belt-sander',
    });
  });
  afterEach(() => framework.close());

  const viewModel = async (user = superUser) =>
    getRightOrFail(await constructViewModel(framework, user)());

  it('counts how many machines have each', async () => {
    const model = await viewModel();
    expect(model.total).toBe(3);
    expect(model.withGuide).toBe(2);
    expect(model.withRiskAssessment).toBe(1);
  });

  // The point of the page is the gaps, so they come first.
  it('separates the machines missing something from the complete ones', async () => {
    const model = await viewModel();
    expect(model.missing.map(item => item.name)).toEqual([
      'Belt Sander',
      'Chop Saw',
    ]);
    expect(model.complete.map(item => item.name)).toEqual(['Band Saw']);
  });

  it('carries the links it does have', async () => {
    const model = await viewModel();
    expect(model.complete[0]?.guideUrl).toStrictEqual(
      O.some('https://equipment.makespace.org/wood-shop/band-saw')
    );
    expect(model.missing[0]?.riskAssessmentUrl).toStrictEqual(O.none);
  });

  // A retired machine needs neither, and listing it would make the gaps look
  // worse than they are.
  it('leaves out machines marked obsolete', async () => {
    await framework.commands.equipment.markObsolete({id: neither});
    const model = await viewModel();
    expect(model.total).toBe(2);
    expect(model.missing.map(item => item.name)).toEqual(['Belt Sander']);
  });

  it('refuses anybody who is not a super user', async () => {
    const failure = getLeftOrFail(
      await constructViewModel(framework, ordinaryUser)()
    );
    expect(failure.status).toBe(403);
  });
});
