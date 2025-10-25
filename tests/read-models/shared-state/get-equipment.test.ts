import {faker} from '@faker-js/faker';
import {TestFramework, initTestFramework} from '../test-framework';
import {NonEmptyString, UUID} from 'io-ts-types';
import {pipe} from 'fp-ts/lib/function';
import * as O from 'fp-ts/Option';
import {getRightOrFail, getSomeOrFail} from '../../helpers';

import {Actor, EmailAddress} from '../../../src/types';
import {Int} from 'io-ts';
import {updateState} from '../../../src/read-models/shared-state/update-state';
import {EventOfType} from '../../../src/types/domain-event';
import {
  markMemberTrainedBy,
  MarkMemberTrainedBy,
} from '../../../src/commands/trainers/mark-member-trained-by';
import {DateTime, Duration} from 'luxon';
import {LinkNumberToEmail} from '../../../src/commands/member-numbers/link-number-to-email';
import {applyToResource} from '../../../src/commands/apply-command-to-resource';
import {RevokeMemberTrained} from '../../../src/commands/trainers/revoke-member-trained';
import {AddTrainer} from '../../../src/commands/trainers/add-trainer';

describe('get', () => {
  let framework: TestFramework;
  const equipmentId = faker.string.uuid() as UUID;
  const runQuery = () =>
    pipe(equipmentId, framework.sharedReadModel.equipment.get, getSomeOrFail);
  const addTrainerMember = {
    memberNumber: faker.number.int(),
    email: faker.internet.email() as EmailAddress,
    name: undefined,
    formOfAddress: undefined,
  };
  const addTrainedMember = {
    memberNumber: faker.number.int() as Int,
    email: faker.internet.email() as EmailAddress,
    name: undefined,
    formOfAddress: undefined,
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

  beforeEach(async () => {
    framework = await initTestFramework();
  });
  afterEach(() => {
    framework.close();
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

    it('has no training sheet', () => {
      const equipment = runQuery();
      expect(equipment.trainingSheetId).toStrictEqual(O.none);
    });

    describe('a member is marked as trained by the trainer (via admin)', () => {
      const newMember: LinkNumberToEmail = {
        memberNumber: faker.number.int(),
        email: faker.internet.email() as EmailAddress,
        name: faker.company.buzzNoun(),
        formOfAddress: undefined,
      };
      const markTrainedBy: MarkMemberTrainedBy = {
        equipmentId: addEquipment.id,
        trainedByMemberNumber: addTrainer.memberNumber as Int,
        trainedAt: DateTime.now()
          .minus(Duration.fromObject({hours: 1}))
          .toJSDate(),
        memberNumber: newMember.memberNumber as Int,
      };
      const markTrainedByActor: Actor = {
        tag: 'user',
        user: {
          emailAddress: faker.internet.email() as EmailAddress,
          memberNumber: faker.number.int(),
        },
      };
      beforeEach(async () => {
        await framework.commands.memberNumbers.linkNumberToEmail(newMember);
        getRightOrFail(
          await applyToResource(
            framework.depsForApplyToResource,
            markMemberTrainedBy
          )(markTrainedBy, markTrainedByActor)()
        );
      });

      it('shows the user as trained', () => {
        const equipment = runQuery();
        const trainedMembers = equipment.trainedMembers.filter(
          m => m.memberNumber === markTrainedBy.memberNumber
        );
        expect(trainedMembers).toHaveLength(1);
        const trainedMember = trainedMembers[0];
        expect(trainedMember.memberNumber).toStrictEqual(
          markTrainedBy.memberNumber
        );
        expect(trainedMember.emailAddress).toStrictEqual(newMember.email);
        expect(trainedMember.trainedByEmail).toStrictEqual(
          O.some(addTrainerMember.email)
        );
        expect(trainedMember.trainedByMemberNumber).toStrictEqual(
          O.some(addTrainerMember.memberNumber)
        );
        expect(
          // The database truncates milliseconds.
          Math.floor(trainedMember.trainedSince.getUTCSeconds())
        ).toStrictEqual(Math.floor(markTrainedBy.trainedAt.getUTCSeconds()));
        expect(trainedMember.legacyImport).toStrictEqual(false);
        expect(trainedMember.name).toStrictEqual(O.some(newMember.name));
        if (!O.isSome(trainedMember.markedTrainedByActor)) {
          throw new Error('Missing marked trained by actor');
        }
        expect(trainedMember.markedTrainedByActor.value).toStrictEqual(
          markTrainedByActor
        );
      });

      describe('Training is revoked on user', () => {
        const revokeTrained: RevokeMemberTrained = {
          equipmentId,
          memberNumber: markTrainedBy.memberNumber,
        };
        beforeEach(async () => {
          await framework.commands.trainers.revokeTrained(revokeTrained);
        });

        it('member does not show as trained', () => {
          const equipment = runQuery();
          expect(
            equipment.trainedMembers.map(m => m.memberNumber)
          ).not.toContain(markTrainedBy.memberNumber);
        });
      });
    });

    describe('a member is marked as trained by a non-existant user (via admin)', () => {
      const newMember: LinkNumberToEmail = {
        memberNumber: faker.number.int(),
        email: faker.internet.email() as EmailAddress,
        name: faker.company.buzzNoun(),
        formOfAddress: undefined,
      };
      const markTrainedBy: MarkMemberTrainedBy = {
        equipmentId: addEquipment.id,
        trainedByMemberNumber: faker.number.int() as Int, // non existant member number.
        trainedAt: DateTime.now()
          .minus(Duration.fromObject({hours: 1}))
          .toJSDate(),
        memberNumber: newMember.memberNumber as Int,
      };
      const markTrainedByActor: Actor = {
        tag: 'user',
        user: {
          emailAddress: faker.internet.email() as EmailAddress,
          memberNumber: faker.number.int(),
        },
      };
      beforeEach(async () => {
        await framework.commands.memberNumbers.linkNumberToEmail(newMember);
        getRightOrFail(
          await applyToResource(
            framework.depsForApplyToResource,
            markMemberTrainedBy
          )(markTrainedBy, markTrainedByActor)()
        );
      });

      it('shows the user as trained', () => {
        const equipment = runQuery();
        const trainedMembers = equipment.trainedMembers.filter(
          m => m.memberNumber === markTrainedBy.memberNumber
        );
        expect(trainedMembers).toHaveLength(1);
        const trainedMember = trainedMembers[0];
        expect(trainedMember.memberNumber).toStrictEqual(
          markTrainedBy.memberNumber
        );
        expect(trainedMember.emailAddress).toStrictEqual(newMember.email);

        // The trained by member is fake so there won't be an email registered.
        expect(trainedMember.trainedByEmail).toStrictEqual(O.none);
        expect(trainedMember.trainedByMemberNumber).toStrictEqual(
          O.some(markTrainedBy.trainedByMemberNumber)
        );
        expect(
          // The database truncates milliseconds.
          Math.floor(trainedMember.trainedSince.getUTCSeconds())
        ).toStrictEqual(Math.floor(markTrainedBy.trainedAt.getUTCSeconds()));
        expect(trainedMember.legacyImport).toStrictEqual(false);
        expect(trainedMember.name).toStrictEqual(O.some(newMember.name));
        if (!O.isSome(trainedMember.markedTrainedByActor)) {
          throw new Error('Missing marked trained by actor');
        }
        expect(trainedMember.markedTrainedByActor.value).toStrictEqual(
          markTrainedByActor
        );
      });
    });

    describe('add another trainer', () => {
      const anotherTrainer: LinkNumberToEmail = {
        email: faker.internet.email() as EmailAddress,
        memberNumber: faker.number.int() as Int,
        name: faker.animal.cat(),
        formOfAddress: undefined,
      };
      const addAnotherTrainer: AddTrainer = {
        equipmentId,
        memberNumber: anotherTrainer.memberNumber,
      };

      beforeEach(async () => {
        await framework.commands.memberNumbers.linkNumberToEmail(
          anotherTrainer
        );
        await framework.commands.trainers.add(addAnotherTrainer);
      });
      describe('already trained member is marked as trained by a different trainer (via admin)', () => {
        const markUserTrainedAgain: MarkMemberTrainedBy = {
          equipmentId,
          trainedByMemberNumber: anotherTrainer.memberNumber as Int,
          trainedAt: DateTime.now()
            .minus(Duration.fromObject({hours: 1}))
            .toJSDate(),
          memberNumber: markTrained.memberNumber, // User was already marked trained.
        };
        const markUserTrainedAgainActor: Actor = {
          tag: 'user',
          user: {
            // An 'admin'
            emailAddress: faker.internet.email() as EmailAddress,
            memberNumber: faker.number.int(),
          },
        };

        beforeEach(async () => {
          getRightOrFail(
            await applyToResource(
              framework.depsForApplyToResource,
              markMemberTrainedBy
            )(markUserTrainedAgain, markUserTrainedAgainActor)()
          );
        });

        it('shows the user as trained by the different trainer', () => {
          const equipment = runQuery();
          const trainedMembers = equipment.trainedMembers.filter(
            m => m.memberNumber === markTrained.memberNumber
          );
          expect(trainedMembers).toHaveLength(1);
          const trainedMember = trainedMembers[0];
          expect(trainedMember.memberNumber).toStrictEqual(
            markTrained.memberNumber
          );
          expect(trainedMember.emailAddress).toStrictEqual(
            addTrainedMember.email
          );
          expect(trainedMember.trainedByEmail).toStrictEqual(
            O.some(anotherTrainer.email)
          );
          expect(trainedMember.trainedByMemberNumber).toStrictEqual(
            O.some(anotherTrainer.memberNumber)
          );
          expect(
            // The database truncates milliseconds.
            Math.floor(trainedMember.trainedSince.getUTCSeconds())
          ).toStrictEqual(
            Math.floor(markUserTrainedAgain.trainedAt.getUTCSeconds())
          );
          expect(trainedMember.legacyImport).toStrictEqual(false);
          expect(trainedMember.name).toStrictEqual(
            // Add trained member name isn't set so therefore its returned at None
            addTrainedMember.name ? O.some(addTrainedMember.name) : O.none
          );
          if (!O.isSome(trainedMember.markedTrainedByActor)) {
            throw new Error('Missing marked trained by actor');
          }
          expect(trainedMember.markedTrainedByActor.value).toStrictEqual(
            markUserTrainedAgainActor
          );
        });
      });
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
      name: undefined,
      formOfAddress: undefined,
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
      name: undefined,
      formOfAddress: undefined,
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
        name: undefined,
        formOfAddress: undefined,
      };
      const trainer = {
        memberNumber: faker.number.int() as Int,
        email: faker.internet.email() as EmailAddress,
        name: undefined,
        formOfAddress: undefined,
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
            const update = updateState(
              framework.sharedReadModel.db,
              framework.sharedReadModel.linking
            );
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

  describe('Equipment added to non-existant area', () => {
    beforeEach(async () => {
      await framework.commands.equipment.add(addEquipment);
    });

    it('returns the equipment', () => {
      const equipment = runQuery();
      expect(equipment.id).toStrictEqual(addEquipment.id);
    });
    it('returns the area but with the name as unknown', () => {
      const equipment = runQuery();
      expect(equipment.area.id).toStrictEqual(createArea.id);
      expect(equipment.area.name).toStrictEqual('unknown');
    });
  });

  describe('training sheet registered', () => {
    beforeEach(async () => {
      await framework.commands.area.create(createArea);
      await framework.commands.equipment.add(addEquipment);
      await framework.commands.equipment.trainingSheet(addTrainingSheet);
    });

    it('returns the training sheet', () => {
      const equipment = runQuery();
      expect(equipment.trainingSheetId).toStrictEqual(
        O.some(addTrainingSheet.trainingSheetId)
      );
    });

    describe('training sheet remove', () => {
      beforeEach(async () => {
        await framework.commands.equipment.removeTrainingSheet({
          equipmentId: addTrainingSheet.equipmentId,
        });
      });
      it('has no training sheet', () => {
        const equipment = runQuery();
        expect(equipment.trainingSheetId).toStrictEqual(O.none);
      });
    });

    describe('another training sheet registered', () => {
      const secondAddTrainingSheet = {
        equipmentId: addTrainingSheet.equipmentId,
        trainingSheetId: faker.string.alpha(8),
      };
      beforeEach(async () => {
        await framework.commands.equipment.trainingSheet(
          secondAddTrainingSheet
        );
      });
      it('returns the new training sheet', () => {
        const equipment = runQuery();
        expect(equipment.trainingSheetId).toStrictEqual(
          O.some(secondAddTrainingSheet.trainingSheetId)
        );
      });
    });
  });
});
