import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';
import {setRiskAssessmentUrl} from '../../../src/commands/equipment/set-risk-assessment-url';
import {getSomeOrFail} from '../../helpers';
import {
  TestFramework,
  initTestFramework,
} from '../../read-models/test-framework';

describe('recording where a risk assessment lives', () => {
  describe('what the form is allowed to send', () => {
    const equipmentId = faker.string.uuid() as UUID;
    const decode = (riskAssessmentUrl: string) =>
      setRiskAssessmentUrl.decode({equipmentId, riskAssessmentUrl});

    it('accepts a web address', () => {
      expect(E.isRight(decode('https://drive.google.com/file/d/abc/view'))).toBe(
        true
      );
    });

    it('accepts an empty value, which clears the link', () => {
      expect(decode('')).toStrictEqual(
        E.right({equipmentId, riskAssessmentUrl: ''})
      );
    });

    // The value ends up in an href, so anything that is not plainly a web
    // page is refused rather than rendered.
    it.each([
      ['drive.google.com/file/d/abc/view'],
      ['the shared drive'],
      ['javascript:alert(1)'],
      ['ftp://example.com/ra.pdf'],
    ])('refuses %s, which is not a web address', value => {
      expect(E.isLeft(decode(value))).toBe(true);
    });

    it('trims whatever was pasted', () => {
      expect(decode('  https://example.com/ra  ')).toStrictEqual(
        E.right({equipmentId, riskAssessmentUrl: 'https://example.com/ra'})
      );
    });
  });

  describe('against the read model', () => {
    let framework: TestFramework;
    const equipmentId = faker.string.uuid() as UUID;
    const areaId = faker.string.uuid() as UUID;

    beforeEach(async () => {
      framework = await initTestFramework();
      await framework.commands.area.create({
        id: areaId,
        name: faker.company.buzzNoun() as NonEmptyString,
      });
      await framework.commands.equipment.add({
        id: equipmentId,
        name: faker.company.buzzNoun() as NonEmptyString,
        areaId,
      });
    });
    afterEach(() => framework.close());

    it('shows the address once recorded', async () => {
      await framework.commands.equipment.setRiskAssessmentUrl({
        equipmentId,
        riskAssessmentUrl: 'https://example.com/ra',
      });
      expect(
        getSomeOrFail(framework.sharedReadModel.equipment.get(equipmentId))
          .riskAssessmentUrl
      ).toStrictEqual(O.some('https://example.com/ra'));
    });

    it('holds none until somebody records one', () => {
      expect(
        getSomeOrFail(framework.sharedReadModel.equipment.get(equipmentId))
          .riskAssessmentUrl
      ).toStrictEqual(O.none);
    });

    it('clears the link rather than recording a blank one', async () => {
      await framework.commands.equipment.setRiskAssessmentUrl({
        equipmentId,
        riskAssessmentUrl: 'https://example.com/ra',
      });
      await framework.commands.equipment.setRiskAssessmentUrl({
        equipmentId,
        riskAssessmentUrl: '',
      });
      expect(
        getSomeOrFail(framework.sharedReadModel.equipment.get(equipmentId))
          .riskAssessmentUrl
      ).toStrictEqual(O.none);
    });

    it('is independent of the equipment guide', async () => {
      await framework.commands.equipment.setGuideUrl({
        equipmentId,
        guideUrl: 'https://equipment.makespace.org/a/b',
      });
      await framework.commands.equipment.setRiskAssessmentUrl({
        equipmentId,
        riskAssessmentUrl: 'https://example.com/ra',
      });
      const equipment = getSomeOrFail(
        framework.sharedReadModel.equipment.get(equipmentId)
      );
      expect(equipment.guideUrl).toStrictEqual(
        O.some('https://equipment.makespace.org/a/b')
      );
      expect(equipment.riskAssessmentUrl).toStrictEqual(
        O.some('https://example.com/ra')
      );
    });
  });
});
