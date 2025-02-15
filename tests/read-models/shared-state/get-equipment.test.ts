import {faker} from '@faker-js/faker';
import {TestFramework, initTestFramework} from '../test-framework';
import {NonEmptyString, UUID} from 'io-ts-types';
import {pipe} from 'fp-ts/lib/function';
import {getSomeOrFail} from '../../helpers';

import {EmailAddress} from '../../../src/types';
import {Int} from 'io-ts';
import {updateState} from '../../../src/read-models/shared-state/update-state';
import {constructEvent, EventOfType} from '../../../src/types/domain-event';
import {trainingQuizTable} from '../../../src/read-models/shared-state/state';

describe('get', () => {
  let framework: TestFramework;
  const equipmentId = faker.string.uuid() as UUID;
  const runQuery = () =>
    pipe(equipmentId, framework.sharedReadModel.equipment.get, getSomeOrFail);
  const addTrainerMember = {
    memberNumber: faker.number.int(),
    email: faker.internet.email() as EmailAddress,
  };
  const addTrainedMember = {
    memberNumber: faker.number.int() as Int,
    email: faker.internet.email() as EmailAddress,
  };
  const createArea = {
    id: faker.string.uuid() as UUID,
    name: faker.airline.airport().name as NonEmptyString,
  };
  const addEquipment = {
    id: equipmentId,
    name: faker.science.chemicalElement().name as NonEmptyString,
    areaId: createArea.id,
  };
  const addOwner = {
    memberNumber: addTrainerMember.memberNumber,
    areaId: createArea.id,
  };
  const removeOwner = {
    memberNumber: addOwner.memberNumber,
    areaId: addOwner.areaId,
  };
  const addTrainer = {
    memberNumber: addTrainerMember.memberNumber,
    equipmentId: equipmentId,
  };
  const markTrained = {
    equipmentId: equipmentId,
    memberNumber: addTrainedMember.memberNumber,
  };
  const addTrainingSheet = {
    equipmentId,
    trainingSheetId: 'testTrainingSheetId',
  };
  const passedQuizResult = {
    id: faker.string.uuid() as UUID,
    equipmentId: addEquipment.id,
    trainingSheetId: addTrainingSheet.trainingSheetId,
    memberNumberProvided: addTrainerMember.memberNumber,
    emailProvided: addTrainerMember.email,
    score: 10,
    maxScore: 10,
    percentage: 100,
    timestampEpochMS: 1739621371,
  };

  beforeEach(async () => {
    framework = await initTestFramework();
  });

  describe('when equipment has a trainer and trained users', () => {
    beforeEach(async () => {
      await framework.commands.memberNumbers.linkNumberToEmail(
        addTrainerMember
      );
      await framework.commands.memberNumbers.linkNumberToEmail(
        addTrainedMember
      );
      await framework.commands.area.create(createArea);
      await framework.commands.equipment.add(addEquipment);
      await framework.commands.area.addOwner(addOwner);
      await framework.commands.trainers.add(addTrainer);
      await framework.commands.trainers.markTrained(markTrained);
    });

    it('returns the equipment', () => {
      const equipment = runQuery();
      expect(equipment.id).toStrictEqual(addEquipment.id);
    });

    it('returns the trainer', () => {
      const equipment = runQuery();
      expect(equipment.trainers).toHaveLength(1);
      expect(equipment.trainers[0].memberNumber).toStrictEqual(
        addTrainer.memberNumber
      );
    });

    it('returns the trained users', () => {
      const equipment = runQuery();
      expect(equipment.trainedMembers).toHaveLength(1);
      expect(equipment.trainedMembers[0].memberNumber).toStrictEqual(
        markTrained.memberNumber
      );
    });

    it('returns the area it belongs to', () => {
      const equipment = runQuery();
      expect(equipment.area.id).toStrictEqual(createArea.id);
      expect(equipment.area.name).toStrictEqual(createArea.name);
    });
  });

  describe('when someone was marked as trainer without being an owner', () => {
    beforeEach(async () => {
      await framework.commands.memberNumbers.linkNumberToEmail(
        addTrainerMember
      );
      await framework.commands.area.create(createArea);
      await framework.commands.equipment.add(addEquipment);
      await framework.commands.trainers.add(addTrainer);
    });

    it('returns that they are not an owner', () => {
      const member = pipe(
        addTrainer.memberNumber,
        framework.sharedReadModel.members.get,
        getSomeOrFail
      );
      expect(member.ownerOf).toHaveLength(0);
    });

    it('returns that they are not a trainer', () => {
      const member = pipe(
        addTrainer.memberNumber,
        framework.sharedReadModel.members.get,
        getSomeOrFail
      );
      expect(member.trainerFor).toHaveLength(0);
    });
  });

  describe('when someone was an owner and trainer but is no longer an owner', () => {
    beforeEach(async () => {
      await framework.commands.memberNumbers.linkNumberToEmail(
        addTrainerMember
      );
      await framework.commands.area.create(createArea);
      await framework.commands.equipment.add(addEquipment);
      await framework.commands.area.addOwner(addOwner);
      await framework.commands.trainers.add(addTrainer);
      await framework.commands.area.removeOwner(removeOwner);
    });

    it('returns that they are not an owner', () => {
      const member = pipe(
        addTrainer.memberNumber,
        framework.sharedReadModel.members.get,
        getSomeOrFail
      );
      expect(member.ownerOf).toHaveLength(0);
    });

    it('returns that they are not a trainer', () => {
      const member = pipe(
        addTrainer.memberNumber,
        framework.sharedReadModel.members.get,
        getSomeOrFail
      );
      expect(member.trainerFor).toHaveLength(0);
    });
  });

  describe('when someone was an owner and trainer in two areas but is no longer an owner in one', () => {
    const createAnotherArea = {
      id: faker.string.uuid() as UUID,
      name: faker.airline.airport().name as NonEmptyString,
    };
    const addOtherEquipment = {
      id: faker.string.uuid() as UUID,
      name: faker.science.chemicalElement().name as NonEmptyString,
      areaId: createAnotherArea.id,
    };
    const addOwnerToOtherArea = {
      memberNumber: addTrainerMember.memberNumber,
      areaId: createAnotherArea.id,
    };
    const addAsTrainerToOtherEquipment = {
      memberNumber: addTrainerMember.memberNumber,
      equipmentId: addOtherEquipment.id,
    };

    beforeEach(async () => {
      await framework.commands.memberNumbers.linkNumberToEmail(
        addTrainerMember
      );
      await framework.commands.area.create(createArea);
      await framework.commands.equipment.add(addEquipment);
      await framework.commands.area.addOwner(addOwner);
      await framework.commands.trainers.add(addTrainer);

      await framework.commands.area.create(createAnotherArea);
      await framework.commands.equipment.add(addOtherEquipment);
      await framework.commands.area.addOwner(addOwnerToOtherArea);
      await framework.commands.trainers.add(addAsTrainerToOtherEquipment);

      await framework.commands.area.removeOwner(removeOwner);
    });

    it('returns that they are only an owner of the other area', () => {
      const member = pipe(
        addTrainer.memberNumber,
        framework.sharedReadModel.members.get,
        getSomeOrFail
      );
      expect(member.ownerOf).toHaveLength(1);
      expect(member.ownerOf[0].id).toStrictEqual(createAnotherArea.id);
    });

    it('returns that they are only a trainer of the equipment in the other area', () => {
      const member = pipe(
        addTrainer.memberNumber,
        framework.sharedReadModel.members.get,
        getSomeOrFail
      );
      expect(member.trainerFor).toHaveLength(1);
      expect(member.trainerFor[0].equipment_id).toStrictEqual(
        addOtherEquipment.id
      );
    });
  });

  describe('When equipment has a member marked as trained twice', () => {
    const addTrainedMember = {
      memberNumber: faker.number.int() as Int,
      email: faker.internet.email() as EmailAddress,
    };
    const createArea = {
      id: faker.string.uuid() as UUID,
      name: faker.company.buzzNoun() as NonEmptyString,
    };
    const addEquipment = {
      id: equipmentId,
      name: faker.company.buzzNoun() as NonEmptyString,
      areaId: createArea.id,
    };
    const markTrained = {
      equipmentId: equipmentId,
      memberNumber: addTrainedMember.memberNumber,
    };
    let markedTrainedTimestampStart: number;
    let markedTrainedTimestampEnd: number;
    beforeEach(async () => {
      await framework.commands.memberNumbers.linkNumberToEmail(
        addTrainedMember
      );
      await framework.commands.area.create(createArea);
      await framework.commands.equipment.add(addEquipment);
      markedTrainedTimestampStart = Date.now();
      await framework.commands.trainers.markTrained(markTrained);
      markedTrainedTimestampEnd = Date.now();
      await framework.commands.trainers.markTrained(markTrained);
    });

    it('equipment only shows member as trained once', () => {
      const equipment = runQuery();
      expect(equipment.trainedMembers).toHaveLength(1);
    });

    it('member only shows trained once', () => {
      const member = pipe(
        markTrained.memberNumber,
        framework.sharedReadModel.members.get,
        getSomeOrFail
      );
      expect(member.trainedOn).toHaveLength(1);
      expect(member.trainedOn[0].id).toStrictEqual(markTrained.equipmentId);
      expect(member.trainedOn[0].name).toStrictEqual(addEquipment.name);
      expect(member.trainedOn[0].trainedAt.getTime()).toBeLessThanOrEqual(
        markedTrainedTimestampStart
      );
      expect(member.trainedOn[0].trainedAt.getTime()).toBeLessThanOrEqual(
        markedTrainedTimestampEnd
      );
    });
  });

  describe('When equipment has a member marked as trained then revoked', () => {
    const addTrainedMember = {
      memberNumber: faker.number.int() as Int,
      email: faker.internet.email() as EmailAddress,
    };
    const createArea = {
      id: faker.string.uuid() as UUID,
      name: faker.company.buzzNoun() as NonEmptyString,
    };
    const addEquipment = {
      id: equipmentId,
      name: faker.company.buzzNoun() as NonEmptyString,
      areaId: createArea.id,
    };
    const markTrained = {
      equipmentId: equipmentId,
      memberNumber: addTrainedMember.memberNumber,
    };
    const revokeTrained = {
      equipmentId: equipmentId,
      memberNumber: addTrainedMember.memberNumber,
    };
    beforeEach(async () => {
      await framework.commands.memberNumbers.linkNumberToEmail(
        addTrainedMember
      );
      await framework.commands.area.create(createArea);
      await framework.commands.equipment.add(addEquipment);
      await framework.commands.trainers.markTrained(markTrained);
      await framework.commands.trainers.revokeTrained(revokeTrained);
    });

    it("equipment doesn't show the member as trained", () => {
      const equipment = runQuery();
      expect(equipment.trainedMembers).toHaveLength(0);
    });

    describe('Member is then re-trained', () => {
      beforeEach(async () => {
        await framework.commands.trainers.markTrained(markTrained);
      });

      it('Equipment shows the member as trained again', () => {
        const equipment = runQuery();
        expect(equipment.trainedMembers).toHaveLength(1);
      });
    });
  });

  describe('Direct event insert tests', () => {
    // Tests that use direct event insertion to force specific event database state and check the read result.
    // These are required to check resolution of bugs on the write side or to handle things that insert with different
    // rules that the usual UI triggered insertions - for example: legacy training import.

    describe('Member is marked as trained twice on a piece of equipment by the legacy import', () => {
      // This is a specific test case derived from a bug reported during QA after the legacy import.
      const member = {
        memberNumber: faker.number.int() as Int,
        email: faker.internet.email() as EmailAddress,
      };
      const trainer = {
        memberNumber: faker.number.int() as Int,
        email: faker.internet.email() as EmailAddress,
      };
      const createArea = {
        id: faker.string.uuid() as UUID,
        name: faker.company.buzzNoun() as NonEmptyString,
      };
      const equipment1 = {
        id: faker.string.uuid() as UUID,
        name: faker.company.buzzNoun() as NonEmptyString,
        areaId: createArea.id,
      };

      beforeEach(async () => {
        await framework.commands.memberNumbers.linkNumberToEmail(member);
        await framework.commands.memberNumbers.linkNumberToEmail(trainer);
        await framework.commands.area.create(createArea);
        await framework.commands.equipment.add(equipment1);
      });

      // The database truncates the milliseconds on the date which was hiding the duplicate event problem
      // as in reality the events have exactly the same time (to the millisecond) but in tests they were
      // getting rounded leading the tests down the happy/no-duplication path.
      const dates: [string, Date][] = [
        ['With milliseconds', new Date(2024, 11, 2, 23, 12, 23, 323)],
        ['Without milliseconds', new Date(2024, 11, 2, 23, 12, 23, 0)],
      ];

      for (const [name, recordedAt] of dates) {
        describe(`Duplicate events: ${name}`, () => {
          beforeEach(() => {
            // The legacy import inserts events directly
            const update = updateState(framework.sharedReadModel.db);
            const memberTrainedEvents: EventOfType<'MemberTrainedOnEquipment'>[] =
              [
                {
                  trainedByMemberNumber: trainer.memberNumber,
                  equipmentId: equipment1.id,
                },
                {
                  trainedByMemberNumber: trainer.memberNumber,
                  equipmentId: equipment1.id,
                },
              ].map(partialEvent => ({
                legacyImport: true,
                memberNumber: member.memberNumber,
                type: 'MemberTrainedOnEquipment',
                actor: {
                  tag: 'system',
                },
                recordedAt,
                ...partialEvent,
              }));
            memberTrainedEvents.forEach(update);
          });
          const getEquipment = (id: UUID) =>
            getSomeOrFail(framework.sharedReadModel.equipment.get(id));

          const getMember = (memberNumber: number) =>
            getSomeOrFail(framework.sharedReadModel.members.get(memberNumber));

          it('The member is only marked as trained on the piece of equipment once', () => {
            const m = getMember(member.memberNumber);
            const e = getEquipment(equipment1.id);
            expect(m.trainedOn).toHaveLength(1);
            expect(e.trainedMembers).toHaveLength(1);
          });
        });
      }
    });
  });

  describe('User has completed the quiz and passed', () => {
    beforeEach(async () => {
      await framework.commands.memberNumbers.linkNumberToEmail(
        addTrainedMember
      );
      await framework.commands.area.create(createArea);
      await framework.commands.equipment.add(addEquipment);
      await framework.commands.equipment.trainingSheet(addTrainingSheet);
      updateState(framework.sharedReadModel.db)(
        constructEvent('EquipmentTrainingQuizResult')(passedQuizResult)
      );
    });

    describe('User is already trained', () => {
      beforeEach(async () => {
        await framework.commands.trainers.markTrained(markTrained);
      });

      it("User doesn't appear as awaiting training", () => {
        expect(
          getSomeOrFail(
            framework.sharedReadModel.equipment.get(addEquipment.id)
          ).membersAwaitingTraining
        ).toHaveLength(0);
      });
    });

    describe('User is not already trained', () => {
      it('User appears as awaiting training', () => {
        const awaitingTraining = getSomeOrFail(
          framework.sharedReadModel.equipment.get(addEquipment.id)
        ).membersAwaitingTraining;
        expect(awaitingTraining).toHaveLength(1);
        expect(awaitingTraining[0].memberNumber).toStrictEqual(
          addTrainedMember.memberNumber
        );
      });
    });
  });

  describe('Check equipment quiz result event idempotency', () => {
    beforeEach(async () => {
      await framework.commands.memberNumbers.linkNumberToEmail(
        addTrainerMember
      );
      await framework.commands.area.create(createArea);
      await framework.commands.equipment.add(addEquipment);
    });

    [true, false].forEach(quizIdDuplicate => {
      describe(`Duplicate of same event, quiz id duplicate ${quizIdDuplicate}`, () => {
        beforeEach(() => {
          const update = updateState(framework.sharedReadModel.db);
          for (let i = 0; i < 2; i++) {
            if (quizIdDuplicate) {
              update(
                constructEvent('EquipmentTrainingQuizResult')(passedQuizResult)
              );
            } else {
              update(
                constructEvent('EquipmentTrainingQuizResult')({
                  ...passedQuizResult,
                  id: faker.string.uuid() as UUID,
                })
              );
            }
          }
        });
        it('The user is marked as waiting for training exactly once', () => {
          const awaitingTraining = getSomeOrFail(
            framework.sharedReadModel.equipment.get(addEquipment.id)
          ).membersAwaitingTraining;
          expect(awaitingTraining).toHaveLength(1);
          expect(awaitingTraining[0].memberNumber).toStrictEqual(
            addTrainerMember.memberNumber
          );
        });
        it("The shared read model database doesn't contain duplicate entries", () => {
          // Strictly speaking this is looking at the internals however its important we don't let the shared db just grow infinitely
          const rows = framework.sharedReadModel.db
            .select()
            .from(trainingQuizTable)
            .all();
          expect(rows.length).toHaveLength(1);
        });
      });
    });
  });

  describe("User passes equipment quiz twice and hasn't been trained yet", () => {
    beforeEach(async () => {
      await framework.commands.memberNumbers.linkNumberToEmail(
        addTrainerMember
      );
      await framework.commands.area.create(createArea);
      await framework.commands.equipment.add(addEquipment); // We add the equipment but never register a training sheet.
      for (let i = 0; i < 2; i++) {
        updateState(framework.sharedReadModel.db)(
          constructEvent('EquipmentTrainingQuizResult')({
            ...passedQuizResult,
            id: faker.string.uuid() as UUID,
            timestampEpochMS: faker.number.int({
              // Random epoch timestamp.
              min: 1500000000,
              max: 1900000000,
            }),
          })
        );
      }
    });
    // Note that we don't specifically care in this case if the training quiz result is added to the shared read
    // state once or twice since they are technically different events but (currently) produce the same outcome.
    it('The user is marked as waiting for training exactly once', () => {
      const awaitingTraining = getSomeOrFail(
        framework.sharedReadModel.equipment.get(addEquipment.id)
      ).membersAwaitingTraining;
      expect(awaitingTraining).toHaveLength(1);
      expect(awaitingTraining[0].memberNumber).toStrictEqual(
        addTrainerMember.memberNumber
      );
    });
  });

  describe('Check equipment quiz results for no sheet but correct equipment', () => {
    beforeEach(async () => {
      await framework.commands.memberNumbers.linkNumberToEmail(
        addTrainerMember
      );
      await framework.commands.area.create(createArea);
      await framework.commands.equipment.add(addEquipment); // We add the equipment but never register a training sheet.
      updateState(framework.sharedReadModel.db)(
        constructEvent('EquipmentTrainingQuizResult')(passedQuizResult)
      );
    });
    it('No users are marked as waiting for training', () => {
      expect(
        getSomeOrFail(framework.sharedReadModel.equipment.get(addEquipment.id))
          .membersAwaitingTraining
      ).toHaveLength(0);
    });
  });

  describe('Check equipment quiz results for different sheet but correct equipment', () => {
    beforeEach(async () => {
      await framework.commands.memberNumbers.linkNumberToEmail(
        addTrainerMember
      );
      await framework.commands.area.create(createArea);
      await framework.commands.equipment.add(addEquipment);
      await framework.commands.equipment.trainingSheet({
        equipmentId: addEquipment.id,
        trainingSheetId: faker.string.uuid(), // A different training sheet id.
      });
      updateState(framework.sharedReadModel.db)(
        // Events have ended up in the db somehow from an unknown (perhaps removed) training sheet.
        constructEvent('EquipmentTrainingQuizResult')(passedQuizResult)
      );
    });
    it('No users are marked as waiting for training', () => {
      expect(
        getSomeOrFail(framework.sharedReadModel.equipment.get(addEquipment.id))
          .membersAwaitingTraining
      ).toHaveLength(0);
    });
  });
});
