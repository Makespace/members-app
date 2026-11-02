import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';
import {StatusCodes} from 'http-status-codes';
import {Actor} from '../../../src/types/actor';
import {setTrainingRequirements} from '../../../src/commands/equipment/set-training-requirements';
import {arbitraryUser} from '../../types/user.helper';
import {
  getLeftOrFail,
  getRightOrFail,
  getSomeOrFail,
  getTaskEitherRightOrFail,
} from '../../helpers';
import {
  initTestFramework,
  TestFramework,
} from '../../read-models/test-framework';

describe('setting what a machine needs before its training', () => {
  let framework: TestFramework;
  const areaId = faker.string.uuid() as UUID;
  const trotec = faker.string.uuid() as UUID;
  const hpc = faker.string.uuid() as UUID;
  const ownerTrainer = arbitraryUser();
  const ownerOnly = arbitraryUser();
  const trainerOnly = arbitraryUser();
  const as = (user: typeof ownerTrainer): Actor => ({tag: 'user', user});

  describe('reading the form', () => {
    it('takes an unticked quiz box as the quiz not being needed', () => {
      expect(
        getRightOrFail(setTrainingRequirements.decode({equipmentId: trotec}))
      ).toStrictEqual({
        equipmentId: trotec,
        quizRequired: false,
        prerequisiteEquipmentIds: [],
      });
    });

    it('takes one or several machines to be trained on first', () => {
      expect(
        getRightOrFail(
          setTrainingRequirements.decode({
            equipmentId: trotec,
            quizRequired: 'yes',
            prerequisites: hpc,
          })
        )
      ).toStrictEqual({
        equipmentId: trotec,
        quizRequired: true,
        prerequisiteEquipmentIds: [hpc],
      });
      expect(
        getRightOrFail(
          setTrainingRequirements.decode({
            equipmentId: trotec,
            prerequisites: [hpc, hpc],
          })
        ).prerequisiteEquipmentIds
      ).toStrictEqual([hpc]);
    });
  });

  describe('against the read model', () => {
    beforeEach(async () => {
      framework = await initTestFramework();
      await framework.commands.area.create({
        id: areaId,
        name: 'Laser Room' as NonEmptyString,
      });
      for (const [id, name] of [
        [trotec, 'Trotec Laser'],
        [hpc, 'HPC Laser'],
      ] as const) {
        await framework.commands.equipment.add({
          id,
          name: name as NonEmptyString,
          areaId,
        });
      }
      for (const user of [ownerTrainer, ownerOnly, trainerOnly]) {
        await framework.commands.memberNumbers.linkNumberToEmail({
          memberNumber: user.memberNumber,
          email: user.emailAddress,
          name: undefined,
          formOfAddress: undefined,
        });
      }
      for (const user of [ownerTrainer, ownerOnly]) {
        await framework.commands.area.addOwner({
          areaId,
          memberNumber: user.memberNumber,
        });
      }
      for (const user of [ownerTrainer, trainerOnly]) {
        await framework.commands.trainers.add({
          equipmentId: trotec,
          memberNumber: user.memberNumber,
        });
      }
    });

    afterEach(() => {
      framework.close();
    });

    const requirements = (quizRequired: boolean, prerequisites: UUID[]) => ({
      equipmentId: trotec,
      quizRequired,
      prerequisiteEquipmentIds: prerequisites,
    });

    const process = (command: ReturnType<typeof requirements>) =>
      setTrainingRequirements.process({
        command: {...command, actor: as(ownerTrainer)},
        rm: framework.sharedReadModel,
      });

    it('is for owners who also train on the machine, and super-users', () => {
      const allowed = (actor: Actor) =>
        setTrainingRequirements.isAuthorized({
          actor,
          rm: framework.sharedReadModel,
          input: requirements(false, []),
        });
      expect(allowed(as(ownerTrainer))).toBe(true);
      expect(allowed(as(ownerOnly))).toBe(false);
      expect(allowed(as(trainerOnly))).toBe(false);
      expect(allowed({tag: 'token', token: 'admin'})).toBe(true);
    });

    it('needs the quiz and nothing else until it is set', () => {
      expect(
        framework.sharedReadModel.trainingRequirements.get(trotec)
      ).toStrictEqual({quizRequired: true, prerequisiteEquipmentIds: []});
    });

    it('records what was chosen, replacing what was there', async () => {
      await framework.commands.equipment.setTrainingRequirements(
        requirements(false, [hpc])
      );
      expect(
        framework.sharedReadModel.trainingRequirements.get(trotec)
      ).toStrictEqual({quizRequired: false, prerequisiteEquipmentIds: [hpc]});

      await framework.commands.equipment.setTrainingRequirements(
        requirements(true, [])
      );
      expect(
        framework.sharedReadModel.trainingRequirements.get(trotec)
      ).toStrictEqual({quizRequired: true, prerequisiteEquipmentIds: []});
    });

    it('records nothing when nothing changed', async () => {
      await framework.commands.equipment.setTrainingRequirements(
        requirements(false, [hpc])
      );
      expect(
        await getTaskEitherRightOrFail(process(requirements(false, [hpc])))
      ).toStrictEqual(O.none);
      getSomeOrFail(
        await getTaskEitherRightOrFail(process(requirements(true, [hpc])))
      );
    });

    it.each([
      ['the machine itself', () => [trotec]],
      ['a machine that does not exist', () => [faker.string.uuid() as UUID]],
    ])('refuses %s as a prerequisite', async (_, prerequisites) => {
      const failure = getLeftOrFail(
        await process(requirements(true, prerequisites()))()
      );
      expect(failure.status).toStrictEqual(StatusCodes.BAD_REQUEST);
    });

    it('refuses two machines that would each wait on the other', async () => {
      await framework.commands.equipment.setTrainingRequirements({
        equipmentId: hpc,
        quizRequired: true,
        prerequisiteEquipmentIds: [trotec],
      });
      const failure = getLeftOrFail(
        await process(requirements(true, [hpc]))()
      );
      expect(failure.status).toStrictEqual(StatusCodes.BAD_REQUEST);
      expect(failure.message).toContain('HPC Laser');
    });
  });
});
