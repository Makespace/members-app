import * as O from 'fp-ts/Option';
import {advanceTo} from 'jest-date-mock';
import {constructEvent, EmailAddress} from '../../../src/types';
import {TestFramework, initTestFramework} from '../test-framework';
import {faker} from '@faker-js/faker';
import {getSomeOrFail} from '../../helpers';
import {pipe} from 'fp-ts/lib/function';
import {gravatarHashFromEmail} from '../../../src/read-models/members/avatar';
import {NonEmptyString, UUID} from 'io-ts-types';
import {Int} from 'io-ts';

describe('get-via-shared-read-model', () => {
  let framework: TestFramework;
  beforeEach(async () => {
    framework = await initTestFramework();
  });
  afterEach(() => {
    framework.eventStoreDb.close();
  });

  const memberNumber = faker.number.int() as Int;
  const memberEmail = 'foo@example.com' as EmailAddress;
  const otherMemberNumber = faker.number.int() as Int;
  const runQuery = (id = memberNumber) =>
    pipe(id, framework.sharedReadModel.members.get, getSomeOrFail);

  describe('when the member does not exist', () => {
    it('returns none', () => {
      const result = framework.sharedReadModel.members.get(memberNumber);
      expect(result).toStrictEqual(O.none);
    });
  });

  describe('when the member exists', () => {
    beforeEach(async () => {
      await framework.commands.memberNumbers.linkNumberToEmail({
        memberNumber,
        email: memberEmail,
      });
      await framework.commands.memberNumbers.linkNumberToEmail({
        memberNumber: otherMemberNumber,
        email: faker.internet.email() as EmailAddress,
      });
    });

    it('returns member number, email and gravatar hash', () => {
      const result = runQuery();
      expect(result.memberNumber).toEqual(memberNumber);
      expect(result.emailAddress).toEqual('foo@example.com');
      expect(result.gravatarHash).toStrictEqual(
        gravatarHashFromEmail('foo@example.com')
      );
    });

    describe('and their name has been recorded', () => {
      const name = faker.person.fullName();
      beforeEach(async () => {
        await framework.commands.members.editName({
          memberNumber,
          name,
        });
      });

      it('returns their name', () => {
        const result = runQuery();
        expect(result.name).toStrictEqual(O.some(name));
      });

      it('does not alter other member records', () => {
        const result = runQuery(otherMemberNumber);
        expect(result.name).toStrictEqual(O.none);
      });
    });

    describe('and their details have changed multiple times', () => {
      beforeEach(async () => {
        await framework.commands.members.editName({
          memberNumber,
          name: 'Ix',
        });
        await framework.commands.members.editFormOfAddress({
          memberNumber,
          formOfAddress: 'he/him',
        });
        await framework.commands.members.editName({
          memberNumber,
          name: 'Ford Prefect',
        });
      });

      it('returns latest details', () => {
        const result = runQuery();
        expect(result.name).toStrictEqual(O.some('Ford Prefect'));
        expect(result.formOfAddress).toStrictEqual(O.some('he/him'));
      });
    });

    describe('and their email has changed', () => {
      beforeEach(async () => {
        await framework.commands.members.editEmail({
          memberNumber,
          email: 'updated@example.com' as EmailAddress,
        });
      });

      it('returns the latest email', () => {
        const result = runQuery();
        expect(result.emailAddress).toBe('updated@example.com');
      });

      it('returns a record of previous emails', () => {
        const result = runQuery();
        expect(result.prevEmails).toHaveLength(1);
        expect(result.prevEmails[0]).toStrictEqual('foo@example.com');
      });

      it('returns gravatar hash based on latest email', () => {
        const result = runQuery();
        expect(result.gravatarHash).toStrictEqual(
          gravatarHashFromEmail('updated@example.com')
        );
      });
    });

    describe('and they have been declared a super user', () => {
      const firstMadeSuperUserAt = faker.date.anytime();
      const superUserRevokedAt = faker.date.future({
        refDate: firstMadeSuperUserAt,
      });
      const madeSuperUserAgainAt = faker.date.future({
        refDate: superUserRevokedAt,
      });
      beforeEach(async () => {
        jest.useFakeTimers();
        jest.setSystemTime(firstMadeSuperUserAt);
        await framework.commands.superUser.declare({
          memberNumber,
        });
      });
      afterEach(() => {
        jest.useRealTimers();
      });

      it('they are a superuser', () => {
        const result = runQuery();
        expect(result.isSuperUser).toBe(true);
      });

      it('they have a date since when they have been a superuser', () => {
        const result = pipe(
          runQuery(),
          member => member.superUserSince,
          getSomeOrFail
        );
        expect(result).toEqual(firstMadeSuperUserAt);
      });

      describe('and when their superuser status has been revoked', () => {
        beforeEach(async () => {
          jest.setSystemTime(superUserRevokedAt);
          await framework.commands.superUser.revoke({
            memberNumber,
          });
        });

        it('they are no longer a superuser', () => {
          const result = runQuery();
          expect(result.isSuperUser).toBe(false);
        });

        it('they no longer have a date since when they have been a superuser', () => {
          const result = runQuery();
          expect(result.superUserSince).toStrictEqual(O.none);
        });

        describe('and they have been again declared to be a super user', () => {
          beforeEach(async () => {
            jest.setSystemTime(madeSuperUserAgainAt);
            await framework.commands.superUser.declare({
              memberNumber,
            });
          });

          it('they are a superuser', () => {
            const result = runQuery();
            expect(result.isSuperUser).toBe(true);
          });

          it('they have a date since when they have been a superuser', () => {
            const result = pipe(
              runQuery(),
              member => member.superUserSince,
              getSomeOrFail
            );
            expect(result).toEqual(madeSuperUserAgainAt);
          });
        });
      });

      describe('and then they rejoin with a new member number', () => {
        it.todo('they are no longer a superuser');
        describe('and they have been again declared to be a super user', () => {
          it.todo('they are a superuser');
          it.todo('they have a new date since when they have been a superuser');
        });
      });
    });

    describe('and they have signed the owner agreement', () => {
      const signedAt = faker.date.future();

      beforeEach(async () => {
        await framework.commands.members.signOwnerAgreement({
          memberNumber,
          signedAt,
        });
      });

      it('returns the date they signed it', () => {
        const result = runQuery();
        expect(result.agreementSigned).toStrictEqual(O.some(signedAt));
      });
    });

    describe('and they have been trained', () => {
      const createArea = {
        name: faker.company.buzzNoun() as NonEmptyString,
        id: faker.string.uuid() as UUID,
      };
      const createEquipment = {
        name: faker.company.buzzNoun() as NonEmptyString,
        id: faker.string.uuid() as UUID,
        areaId: createArea.id,
      };
      const trainedAt = faker.date.future();
      trainedAt.setMilliseconds(0);
      beforeEach(async () => {
        advanceTo(faker.date.past());
        await framework.commands.area.create(createArea);
        await framework.commands.equipment.add(createEquipment);
        advanceTo(trainedAt);
        await framework.commands.trainers.markTrained({
          memberNumber: memberNumber,
          equipmentId: createEquipment.id,
        });
      });

      it('returns the equipment name and id', () => {
        const result = runQuery();
        expect(result.trainedOn).toHaveLength(1);
        expect(result.trainedOn[0].id).toStrictEqual(createEquipment.id);
        expect(result.trainedOn[0].name).toStrictEqual(createEquipment.name);
      });

      it('returns date they were marked as trained', () => {
        const result = runQuery();
        expect(result.trainedOn[0].trainedAt).toStrictEqual(trainedAt);
      });
    });

    describe('and they have signed the owner agreement', () => {
      const signedAt = faker.date.past();
      beforeEach(async () => {
        advanceTo(signedAt);
        await framework.commands.members.signOwnerAgreement({
          memberNumber: memberNumber,
          signedAt,
        });
      });

      it('returns the date they signed it', () => {
        const result = runQuery();
        expect(result.agreementSigned).toStrictEqual(O.some(signedAt));
      });
    });

    describe('and they are an owner of an area', () => {
      const createArea = {
        name: faker.company.buzzNoun() as NonEmptyString,
        id: faker.string.uuid() as UUID,
      };
      const recordedAt = faker.date.future();
      recordedAt.setMilliseconds(0);
      beforeEach(async () => {
        await framework.commands.area.create(createArea);
        advanceTo(recordedAt);
        await framework.commands.area.addOwner({
          memberNumber: memberNumber,
          areaId: createArea.id,
        });
      });

      it('returns the area name and id', () => {
        const result = runQuery();
        expect(result.ownerOf).toHaveLength(1);
        expect(result.ownerOf[0].id).toStrictEqual(createArea.id);
        expect(result.ownerOf[0].name).toStrictEqual(createArea.name);
      });

      it('returns when they became an owner', () => {
        const result = runQuery();
        expect(result.ownerOf[0].ownershipRecordedAt).toStrictEqual(recordedAt);
      });
    });

    describe('and they are an owner of a removed area', () => {
      const createArea = {
        name: faker.company.buzzNoun() as NonEmptyString,
        id: faker.string.uuid() as UUID,
      };
      beforeEach(async () => {
        await framework.commands.area.create(createArea);
        await framework.commands.area.addOwner({
          memberNumber: memberNumber,
          areaId: createArea.id,
        });
        await framework.commands.area.remove({id: createArea.id});
      });

      it('returns that they are no longer an owner', () => {
        const result = runQuery();
        expect(result.ownerOf).toHaveLength(0);
      });
    });

    [true, false].forEach(withinTrainingLapsePeriod => {
      // This next section gets a little complicated as there are many cases to consider. If you have any ideas for how to structure the order of operations in
      // a clearer way then please reach out.
      //
      // There are 3 scenarios covered here.
      // 1. The member rejoins with a different membership number, the same email and no actions have been taken on the new account prior to linking the accounts.
      // 2. The member rejoins with a different membership number, a different email and no actions have been taken on the new account prior to linking the accounts.
      // 3. The member rejoins with a different membership number, the same email and some actions have been taken on the new account prior to linking the accounts.
      // 3. The member rejoins with a different membership number, a different email and some actions have been taken on the new account prior to linking the accounts.

      // 'Some actions prior to linking the accounts' means things like marking the member as trained on 1 piece of equipment on their new account before linking it to their
      // old one. We are specifically checking that the order of operations isn't important as sometimes members don't get registered as having rejoined for awhile.
      // Note that the 'normal' order of operations is that the new and old accounts are linked immediately - i.e. there are no actions prior to linking the accounts.
      [true, false].forEach(useExistingEmail => {
        describe(`and they have left and then rejoined with a new member number ${withinTrainingLapsePeriod ? 'within' : 'without'} the training-lapse period`, () => {
          describe(
            useExistingEmail
              ? 'using their existing email'
              : 'using a new email',
            () => {
              const newMembershipNumber = faker.number.int() as Int;
              const newEmail = faker.internet.email() as EmailAddress;

              // Create some example equipment + area to be used throughout these tests.
              // This equipment/area is not specifically important to the test.
              const equipmentId = faker.string.uuid() as UUID;
              const areaId = faker.string.uuid() as UUID;
              const trainingSheetId = faker.string.uuid() as UUID;
              beforeEach(async () => {
                await framework.commands.area.create({
                  id: areaId,
                  name: faker.airline.airline().name as NonEmptyString,
                });
                await framework.commands.equipment.add({
                  id: equipmentId,
                  name: faker.airline.airplane().name as NonEmptyString,
                  areaId,
                });
                await framework.commands.equipment.trainingSheet({
                  equipmentId,
                  trainingSheetId,
                });
              });

              const markMemberRejoined = useExistingEmail
                ? async () => {
                    // If an account already exists with an email then the linking of membership number -> email fails but you can still mark the user as rejoined
                    // to reuse the email.
                    await framework.commands.memberNumbers.markMemberRejoined({
                      oldMembershipNumber: memberNumber,
                      newMembershipNumber,
                    });
                  }
                : async () => {
                    // In this case we are creating a new account with a new email and then linking the accounts.
                    // This is 1 way to handle a rejoin however it is more of an edge case. It is likely better just to
                    // take the old account, update the email and then mark that member as rejoined.
                    await framework.commands.memberNumbers.linkNumberToEmail({
                      memberNumber: newMembershipNumber,
                      email: newEmail,
                    });
                    await framework.commands.memberNumbers.markMemberRejoined({
                      oldMembershipNumber: memberNumber,
                      newMembershipNumber,
                    });
                  };
              const markTrainedOnOldNumber = () =>
                framework.commands.trainers.markTrained({
                  memberNumber,
                  equipmentId: equipmentId,
                });
              const markTrainedOnNewNumber = () =>
                framework.commands.trainers.markTrained({
                  memberNumber: newMembershipNumber,
                  equipmentId: equipmentId,
                });
              const quizPass = (memberNumber: number, email: EmailAddress) =>
                framework.sharedReadModel.updateState(
                  constructEvent('EquipmentTrainingQuizResult')({
                    id: faker.string.uuid() as UUID,
                    equipmentId,
                    trainingSheetId,
                    memberNumberProvided: memberNumber,
                    emailProvided: email,
                    score: 10,
                    maxScore: 10,
                    percentage: 100,
                    timestampEpochMS: Date.now(),
                  })
                );

              describe('without actions prior to linking accounts', () => {
                // If there are no actions prior to linking then we can perform the linking immediately.
                beforeEach(markMemberRejoined);

                it.todo(
                  'Searching for the member by either number shows the same base data'
                );

                if (withinTrainingLapsePeriod) {
                  describe('and the user is marked trained on equipment on their old number', () => {
                    it.todo('the user shows as trained on their old date');
                    it.todo('Equipment shows as currently trained');
                    describe('and the user is marked trained on the equipment on their new number', () => {
                      it.todo(
                        'the member is shown as trained on their old date'
                      );
                    });
                  });
                  describe('and the user completes a quiz on their old number', () => {
                    it.todo('is shown as awaiting training');
                  });
                  describe('and the user completes a quiz on their new number', () => {
                    it.todo('is shown as awaiting training');
                  });
                  describe('and the user is marked trained on equipment on their new number', () => {
                    it.todo('the user shows as trained');
                    it.todo('Equipment shows as currently trained');
                  });
                  describe('and then they are marked as an owner of an area on their old number', () => {
                    it.todo('The member is shown a owner');
                    describe('and then they are marked as a trainer of a piece of equipment on their old number', () => {
                      it.todo('The member is shown a trainer');
                    });
                    describe('and then they are marked as a trainer of a piece of equipment on their new number', () => {
                      it.todo('The member is shown a trainer');
                    });
                    describe('and then they are marked as an owner of the area on their new number', () => {
                      it.todo('The member is still shown as an owner');
                    });
                    describe('and then they are removed as an owner of the area on their old number', () => {
                      it.todo('The member is not shown as an owner');
                    });
                    describe('and then they are removed as an owner of an area on their new number', () => {
                      it.todo('The member is not shown as an owner'); // Revoking at this point is taken as revoking for both because they were linked at the time.
                    });
                  });
                  describe('and then they are marked as an owner of an area on their new number', () => {
                    it.todo('The member is shown a owner');
                    describe('and then they are marked as a trainer of a piece of equipment on their new number', () => {
                      it.todo('The member is shown a trainer');
                    });
                    describe('and then they are removed as an owner of an area on their new number', () => {
                      it.todo('The member is not shown as an owner');
                    });
                  });
                } else {
                  describe('and the user is marked trained on equipment on their old number', () => {
                    it.todo('Does not transfer training');
                    it.todo("Equipment pages show as 'previously trained'");
                    describe('and the user is marked trained on the equipment on their new number', () => {
                      it.todo(
                        'the member is shown as trained on their new date'
                      );
                    });
                  });
                  describe('and the user completes a quiz on their old number', () => {
                    it.todo('is not shown as awaiting training');
                  });
                  describe('and the user is marked trained on equipment on their new number', () => {
                    it.todo('the member is shown as trained');
                  });
                  describe('and then they are marked as an owner of an area on their old number', () => {
                    it.todo('The member is not shown as a owner');
                    describe('and then they are marked as an owner of the area on their new number', () => {
                      it.todo('The member is shown as an owner');
                      describe('and then they are removed as an owner of an area on their new number', () => {
                        it.todo('The member is not shown as an owner');
                      });
                    });
                  });
                  describe('and then they are marked as an owner of an area on their new number', () => {
                    it.todo('The member is shown a owner');
                    describe('and then they are marked as a trainer of a piece of equipment on their new number', () => {
                      it.todo('The member is shown a trainer');
                    });
                    describe('and then they are removed as an owner of an area on their new number', () => {
                      it.todo('The member is not shown as an owner');
                    });
                  });
                }
                describe('and then they rejoin as a member again', () => {
                  if (withinTrainingLapsePeriod) {
                    it.todo(
                      'all the training ownership/trainer status continues over'
                    );
                  } else {
                    it.todo(
                      'none of the training ownership/trainer status continues over'
                    );
                  }
                });
              });

              describe('with actions prior to linking accounts', () => {
                if (withinTrainingLapsePeriod) {
                  describe('and the user is marked trained on equipment on their old number', () => {
                    beforeEach(async () => {
                      // The user is marked trained on the old number before the linking.
                      await markTrainedOnOldNumber();
                      await markMemberRejoined();
                    });
                    it.todo('the user shows as trained on their old date');
                    it.todo('Equipment shows as currently trained');
                  });
                  describe('and the user is marked trained on equipment on their new number', () => {
                    beforeEach(async () => {
                      await markTrainedOnNewNumber();
                      await markMemberRejoined();
                    });
                    it.todo('the user shows as trained');
                    it.todo('Equipment shows as currently trained');
                  });
                  describe('and the user is marked trained on the equipment on their old number and new number', () => {
                    beforeEach(async () => {
                      await markTrainedOnOldNumber();
                      await markTrainedOnNewNumber();
                      await markMemberRejoined();
                    });
                    it.todo('the member is shown as trained on their old date');
                  });

                  describe('and the user completes a quiz on their old number + existing email', () => {
                    beforeEach(() => quizPass(memberNumber, memberEmail));
                    it.todo('is shown as awaiting training');
                  });
                  if (useExistingEmail) {
                    // If using an existing email then its just the member number that might change on the quiz results.
                    describe('and the user completes a quiz on their new number + existing email', () => {
                      beforeEach(() =>
                        quizPass(newMembershipNumber, memberEmail)
                      );
                      it.todo('is shown as awaiting training');
                      describe('and the user completes a quiz on their old number + existing email', () => {
                        // Handle duplicate quiz results across the new + old numbers.
                        beforeEach(() => quizPass(memberNumber, memberEmail));
                        it.todo('is shown as awaiting training only once');
                      });
                    });
                  } else {
                    // By adding another email into the mix there are more possibilities.
                    describe('and the user completes a quiz on their old number + new email', () => {
                      beforeEach(() => quizPass(memberNumber, newEmail));
                      it.todo('is shown as awaiting training');
                    });
                    describe('and the user completes a quiz on their new number + new email', () => {
                      beforeEach(() => quizPass(newMembershipNumber, newEmail));
                      it.todo('is shown as awaiting training');
                    });
                    describe('and the user completes a quiz on their new number + old email', () => {
                      beforeEach(() =>
                        quizPass(newMembershipNumber, memberEmail)
                      );
                      it.todo('is shown as awaiting training');
                    });
                  }
                  describe('and then they are marked as an owner of an area on their old number', () => {
                    it.todo('The member is shown a owner');
                    describe('and then they are marked as a trainer of a piece of equipment on their old number', () => {
                      it.todo('The member is shown a trainer');
                    });
                    describe('and then they are marked as a trainer of a piece of equipment on their new number', () => {
                      it.todo('The member is shown a trainer');
                    });
                    describe('and then they are marked as an owner of the area on their new number', () => {
                      it.todo('The member is still shown as an owner');
                    });
                    describe('and then they are removed as an owner of the area on their old number', () => {
                      it.todo('The member is not shown as an owner');
                    });
                    describe('and then they are removed as an owner of an area on their new number', () => {
                      it.todo('The member is not shown as an owner'); // Revoking at this point is taken as revoking for both because they were linked at the time.
                    });
                  });
                  describe('and then they are marked as an owner of an area on their new number', () => {
                    it.todo('The member is shown a owner');
                    describe('and then they are marked as a trainer of a piece of equipment on their new number', () => {
                      it.todo('The member is shown a trainer');
                    });
                    describe('and then they are removed as an owner of an area on their new number', () => {
                      it.todo('The member is not shown as an owner');
                    });
                  });
                } else {
                  describe('and the user is marked trained on equipment on their old number', () => {
                    it.todo('Does not transfer training');
                    it.todo("Equipment pages show as 'previously trained'");
                    describe('and the user is marked trained on the equipment on their new number', () => {
                      it.todo(
                        'the member is shown as trained on their new date'
                      );
                    });
                  });
                  describe('and the user completes a quiz on their old number', () => {
                    it.todo('is not shown as awaiting training');
                  });
                  describe('and the user is marked trained on equipment on their new number', () => {
                    it.todo('the member is shown as trained');
                  });
                  describe('and then they are marked as an owner of an area on their old number', () => {
                    it.todo('The member is not shown as a owner');
                    describe('and then they are marked as an owner of the area on their new number', () => {
                      it.todo('The member is shown as an owner');
                      describe('and then they are removed as an owner of an area on their new number', () => {
                        it.todo('The member is not shown as an owner');
                      });
                    });
                  });
                  describe('and then they are marked as an owner of an area on their new number', () => {
                    it.todo('The member is shown a owner');
                    describe('and then they are marked as a trainer of a piece of equipment on their new number', () => {
                      it.todo('The member is shown a trainer');
                    });
                    describe('and then they are removed as an owner of an area on their new number', () => {
                      it.todo('The member is not shown as an owner');
                    });
                  });
                }
              });
            }
          );
        });
      });
    });
  });
});
