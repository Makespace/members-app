import * as O from 'fp-ts/Option';
import * as RA from 'fp-ts/ReadonlyArray';
import {advanceTo} from 'jest-date-mock';
import {EmailAddress} from '../../../src/types';
import {TestFramework, initTestFramework} from '../test-framework';
import {faker} from '@faker-js/faker';
import {expectMatchSecondsPrecision, getSomeOrFail} from '../../helpers';
import {pipe} from 'fp-ts/lib/function';
import {gravatarHashFromEmail} from '../../../src/read-models/members/avatar';
import {NonEmptyString, UUID} from 'io-ts-types';
import {Int} from 'io-ts';
import {allMemberNumbers} from '../../../src/read-models/shared-state/return-types';

const expectUserIsTrainedOnEquipmentAt =
  (framework: TestFramework) =>
  (memberNumber: number, equipmentId: string, expectTrainedAt: Date) =>
    pipe(
      memberNumber,
      framework.sharedReadModel.members.get,
      getSomeOrFail,
      member => member.trainedOn,
      RA.findFirst(e => e.id === equipmentId),
      getSomeOrFail,
      trainedOnEntry => trainedOnEntry.trainedAt,
      expectMatchSecondsPrecision(expectTrainedAt)
    );

const expectUserIsTrainedOnEquipment =
  (framework: TestFramework) => (memberNumber: number, equipmentId: UUID) =>
    expect(
      pipe(
        memberNumber,
        framework.sharedReadModel.members.get,
        getSomeOrFail,
        member => member.trainedOn,
        RA.map(e => e.id)
      )
    ).toContain<UUID>(equipmentId);

const expectedEquipmentHasUserTrained =
  (framework: TestFramework) => (memberNumber: number, equipmentId: UUID) =>
    expect(
      pipe(
        equipmentId,
        framework.sharedReadModel.equipment.get,
        getSomeOrFail,
        e => e.trainedMembers,
        RA.flatMap(allMemberNumbers)
      )
    ).toContain<number>(memberNumber);

// const expectUserAwaitingTraining =
//   (framework: TestFramework) => (memberNumber: number, equipmentId: UUID) =>
//     expect(
//       pipe(
//         equipmentId,
//         framework.sharedReadModel.equipment.get,
//         getSomeOrFail,
//         e => e.membersAwaitingTraining,
//         RA.flatMap(allMemberNumbers)
//       )
//     ).toContain<number>(memberNumber);

// const expectUserNotAwaitingTraining =
//   (framework: TestFramework) => (memberNumber: number, equipmentId: UUID) =>
//     expect(
//       pipe(
//         equipmentId,
//         framework.sharedReadModel.equipment.get,
//         getSomeOrFail,
//         e => e.membersAwaitingTraining,
//         RA.flatMap(allMemberNumbers)
//       )
//     ).not.toContain<number>(memberNumber);

const expectAreaHasOwner =
  (framework: TestFramework) => (memberNumber: number, areaId: UUID) =>
    expect(
      pipe(
        areaId,
        framework.sharedReadModel.area.get,
        getSomeOrFail,
        a => a.owners,
        RA.flatMap(allMemberNumbers)
      )
    ).toContain(memberNumber);

const expectUserIsOwner =
  (framework: TestFramework) => (memberNumber: number, areaId: UUID) =>
    expect(
      pipe(
        memberNumber,
        framework.sharedReadModel.members.get,
        getSomeOrFail,
        m => m.ownerOf,
        RA.map(a => a.id)
      )
    ).toContain(areaId);

const expectUserIsNotOwner =
  (framework: TestFramework) => (memberNumber: number, areaId: UUID) =>
    expect(
      pipe(
        memberNumber,
        framework.sharedReadModel.members.get,
        getSomeOrFail,
        m => m.ownerOf,
        RA.map(a => a.id)
      )
    ).not.toContain(areaId);

const expectAreaDoesNotHaveOwner =
  (framework: TestFramework) => (memberNumber: number, areaId: UUID) =>
    expect(
      pipe(
        areaId,
        framework.sharedReadModel.area.get,
        getSomeOrFail,
        a => a.owners,
        RA.flatMap(allMemberNumbers)
      )
    ).not.toContain(memberNumber);

const expectEquipmentHasUserAsTrainer =
  (framework: TestFramework) => (memberNumber: number, equipmentId: UUID) =>
    expect(
      pipe(
        equipmentId,
        framework.sharedReadModel.equipment.get,
        getSomeOrFail,
        e => e.trainers,
        RA.flatMap(allMemberNumbers)
      )
    ).toContain(memberNumber);

const expectUserIsTrainerFor =
  (framework: TestFramework) => (memberNumber: number, equipmentId: UUID) =>
    expect(
      pipe(
        memberNumber,
        framework.sharedReadModel.members.get,
        getSomeOrFail,
        m => m.trainerFor,
        RA.map(t => t.equipment_id)
      )
    ).toContain<UUID>(equipmentId);

const testOnUsersNumbers =
  (usersMembershipNumbers: [string, Int][]) =>
  (testBody: (memberNumberToCheck: Int) => void) => {
    usersMembershipNumbers.forEach(([name, memberNumberToCheck]) => {
      it(`on their ${name} number`, () => testBody(memberNumberToCheck));
    });
  };

// Not yet implemented so no-op.
const stopMembership = async (_memberNumber: number) => {};

describe('get-via-shared-read-model', () => {
  let framework: TestFramework;
  beforeEach(async () => {
    framework = await initTestFramework();
  });
  afterEach(() => {
    framework.close();
  });

  const userIsTrainer = (
    equipmentId: UUID,
    usersMembershipNumbers: [string, Int][]
  ) => {
    describe('equipment shows user as trainer', () =>
      testOnUsersNumbers(usersMembershipNumbers)(memberNumberToCheck =>
        expectEquipmentHasUserAsTrainer(framework)(
          memberNumberToCheck,
          equipmentId
        )
      ));
    describe('user shows user as trainer', () =>
      testOnUsersNumbers(usersMembershipNumbers)(memberNumberToCheck =>
        expectUserIsTrainerFor(framework)(memberNumberToCheck, equipmentId)
      ));
  };

  const userIsTrained = (
    equipmentId: UUID,
    usersMembershipNumbers: [string, Int][]
  ) => {
    describe('equipment shows user as trained', () =>
      testOnUsersNumbers(usersMembershipNumbers)(membershipNumberToCheck =>
        expectedEquipmentHasUserTrained(framework)(
          membershipNumberToCheck,
          equipmentId
        )
      ));
    describe('user shows user as trained', () =>
      testOnUsersNumbers(usersMembershipNumbers)(membershipNumberToCheck =>
        expectUserIsTrainedOnEquipment(framework)(
          membershipNumberToCheck,
          equipmentId
        )
      ));
  };

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
        name: undefined,
        formOfAddress: undefined,
      });
      await framework.commands.memberNumbers.linkNumberToEmail({
        memberNumber: otherMemberNumber,
        email: faker.internet.email() as EmailAddress,
        name: undefined,
        formOfAddress: undefined,
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

      [true, false].forEach(rejoinWithNewNumber => {
        describe(
          rejoinWithNewNumber
            ? 'and then they rejoin with a new member number'
            : 'and then they rejoin with their existing number',
          () => {
            const newMemberNumber = faker.number.int({
              min: memberNumber + 1,
            }) as Int;
            const newEmail = faker.internet.email() as EmailAddress;
            beforeEach(async () => {
              if (rejoinWithNewNumber) {
                await framework.commands.memberNumbers.linkNumberToEmail({
                  memberNumber: newMemberNumber,
                  email: newEmail,
                  name: undefined,
                  formOfAddress: undefined,
                });
                await framework.commands.memberNumbers.markMemberRejoinedWithNewNumber(
                  {
                    oldMemberNumber: memberNumber,
                    newMemberNumber,
                  }
                );
              } else {
                await framework.commands.memberNumbers.markMemberRejoinedWithExistingNumber(
                  {
                    memberNumber,
                  }
                );
              }
            });

            it('they are no longer a superuser on their existing member number', () => {
              const result = runQuery();
              expect(result.isSuperUser).toBe(false);
            });
            if (rejoinWithNewNumber) {
              it('they are no longer a superuser on their new member number', () => {
                const result = runQuery(newMemberNumber);
                expect(result.isSuperUser).toBe(false);
              });
            }
            (rejoinWithNewNumber ? [true, false] : [false]).forEach(
              declareOnTheirNewNumber =>
                describe(
                  declareOnTheirNewNumber
                    ? 'and they have been again declared to be a super user on their new number'
                    : 'and they have been again declared to be a super user on their existing number',
                  () => {
                    const madeSuperUserAgainAfterRejoinAt = faker.date.future({
                      refDate: madeSuperUserAgainAt,
                    });
                    beforeEach(async () => {
                      jest.setSystemTime(madeSuperUserAgainAfterRejoinAt);
                      if (declareOnTheirNewNumber) {
                        await framework.commands.superUser.declare({
                          memberNumber: newMemberNumber,
                        });
                      } else {
                        await framework.commands.superUser.declare({
                          memberNumber,
                        });
                      }
                    });
                    it('they are a superuser on their existing number', () => {
                      const result = runQuery();
                      expect(result.isSuperUser).toBe(true);
                    });
                    if (rejoinWithNewNumber) {
                      it('they are a superuser on their new number', () => {
                        const result = runQuery(newMemberNumber);
                        expect(result.isSuperUser).toBe(true);
                      });
                    }
                    it('they have a new date since when they have been a superuser on their existing number', () => {
                      const result = pipe(
                        runQuery(),
                        member => member.superUserSince,
                        getSomeOrFail
                      );
                      expect(result).toEqual(madeSuperUserAgainAfterRejoinAt);
                    });
                    if (rejoinWithNewNumber) {
                      it('they have a new date since when they have been a superuser on their new number', () => {
                        const result = pipe(
                          runQuery(newMemberNumber),
                          member => member.superUserSince,
                          getSomeOrFail
                        );
                        expect(result).toEqual(madeSuperUserAgainAfterRejoinAt);
                      });
                    }
                  }
                )
            );
          }
        );
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
    [true, false].forEach(useExistingAccount => {
      describe(`and they have left and then rejoined ${useExistingAccount ? 'using their existing account' : 'using a new account'}`, () => {
        const newMemberNumber = faker.number.int() as Int;
        const newEmail = faker.internet.email() as EmailAddress;

        // Helper for easily checking both old and new accounts.
        const usersMembershipNumbers: [string, Int][] = useExistingAccount
          ? [
              // Only a single member number.
              ['old', memberNumber],
            ]
          : [
              // Both the old and new number to check.
              ['old', memberNumber],
              ['new', newMemberNumber],
            ];

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

        const createNewMemberRecord = () =>
          framework.commands.memberNumbers.linkNumberToEmail({
            memberNumber: newMemberNumber,
            email: newEmail,
            name: undefined,
            formOfAddress: undefined,
          });

        const markMemberRejoined = useExistingAccount
          ? () =>
              // In this case we are marking a member as having rejoined without creating them a new account.
              framework.commands.memberNumbers.markMemberRejoinedWithExistingNumber(
                {
                  memberNumber,
                }
              )
          : () =>
              // In this case we are creating a new account with a new email and then linking the accounts.
              // This is 1 way to handle a rejoin however it is more of an edge case. It is likely better just to
              // take the old account, update the email and then mark that member as rejoined.
              framework.commands.memberNumbers.markMemberRejoinedWithNewNumber({
                oldMemberNumber: memberNumber,
                newMemberNumber,
              });
        const markTrainedOnOldNumber = () =>
          framework.commands.trainers.markTrained({
            memberNumber,
            equipmentId: equipmentId,
          });
        const markTrainedOnNewNumber = () =>
          framework.commands.trainers.markTrained({
            memberNumber: newMemberNumber,
            equipmentId: equipmentId,
          });
        // const quizPass = (memberNumber: number, email: EmailAddress) =>
        //   framework.sharedReadModel.updateState(
        //     constructEvent('EquipmentTrainingQuizResult')({
        //       id: faker.string.uuid() as UUID,
        //       equipmentId,
        //       trainingSheetId,
        //       memberNumberProvided: memberNumber,
        //       emailProvided: email,
        //       score: 10,
        //       maxScore: 10,
        //       percentage: 100,
        //       timestampEpochMS: Date.now(),
        //     })
        //   );
        const markOwner = (memberNumber: number) =>
          framework.commands.area.addOwner({
            areaId,
            memberNumber,
          });
        const revokeOwner = (memberNumber: number) =>
          framework.commands.area.removeOwner({
            areaId,
            memberNumber,
          });
        const markTrainer = (memberNumber: number) =>
          framework.commands.trainers.add({
            equipmentId,
            memberNumber,
          });

        // const userIsAwaitingTraining = (
        //   equipmentId: UUID,
        //   usersMembershipNumbers: [string, Int][]
        // ) =>
        // eslint-disable-next-line jest/no-commented-out-tests
        //   describe('equipment shows user as awaiting training', () =>
        //     testOnUsersNumbers(usersMembershipNumbers)(
        //       membershipNumberToCheck =>
        //         expectUserAwaitingTraining(framework)(
        //           membershipNumberToCheck,
        //           equipmentId
        //         )
        //     ));

        // const userIsNotAwaitingTraining = (
        //   equipmentId: UUID,
        //   usersMembershipNumbers: [string, Int][]
        // ) =>
        // eslint-disable-next-line jest/no-commented-out-tests
        //   describe('equipment does not show user as awaiting training', () =>
        //     testOnUsersNumbers(usersMembershipNumbers)(
        //       membershipNumberToCheck =>
        //         expectUserNotAwaitingTraining(framework)(
        //           membershipNumberToCheck,
        //           equipmentId
        //         )
        //     ));

        const userIsOwner = (
          areaId: UUID,
          usersMembershipNumbers: [string, Int][]
        ) => {
          describe('area shows user as owner', () =>
            testOnUsersNumbers(usersMembershipNumbers)(
              membershipNumberToCheck =>
                expectAreaHasOwner(framework)(membershipNumberToCheck, areaId)
            ));
          describe('user shows user as owner', () =>
            testOnUsersNumbers(usersMembershipNumbers)(
              membershipNumberToCheck =>
                expectUserIsOwner(framework)(membershipNumberToCheck, areaId)
            ));
        };

        const userIsNotOwner = (
          areaId: UUID,
          usersMembershipNumbers: [string, Int][]
        ) => {
          describe('area does not show user as owner', () =>
            testOnUsersNumbers(usersMembershipNumbers)(
              membershipNumberToCheck =>
                expectAreaDoesNotHaveOwner(framework)(
                  membershipNumberToCheck,
                  areaId
                )
            ));
          describe('user does not show user as owner', () =>
            testOnUsersNumbers(usersMembershipNumbers)(
              membershipNumberToCheck =>
                expectUserIsNotOwner(framework)(membershipNumberToCheck, areaId)
            ));
        };

        describe('without actions prior to linking accounts', () => {
          // If there are no actions prior to linking then we can perform the linking immediately.
          // This means all the actions specified below occur after the linking.
          // This means that the training lapse period won't actually have any affect for things
          // like being marked as a trainer because its all happening after the rejoin anyway.
          beforeEach(async () => {
            if (!useExistingAccount) {
              await createNewMemberRecord();
            }
            await markMemberRejoined();
          });

          if (!useExistingAccount) {
            it('Searching for the member by either number shows the same base data', () => {
              const old = framework.sharedReadModel.members.get(memberNumber);
              const newData =
                framework.sharedReadModel.members.get(newMemberNumber);
              expect(getSomeOrFail(old)).toStrictEqual(getSomeOrFail(newData));
            });

            it('Searching for the member by either number (as actor) shows the same base data', () => {
              const asSelf = framework.sharedReadModel.members.getAsActor({
                emailAddress: memberEmail,
                memberNumber: memberNumber,
              });
              const old = asSelf(memberNumber);
              const newData = asSelf(newMemberNumber);
              expect(getSomeOrFail(old)).toStrictEqual(getSomeOrFail(newData));
            });
          }

          it('The list of all members only shows the member once', () => {
            expect(
              framework.sharedReadModel.members
                .getAll()
                .filter(m =>
                  [memberNumber, newMemberNumber].includes(
                    m.memberNumber as Int
                  )
                )
            ).toHaveLength(1);
          });

          describe('and the user is marked trained on equipment on their old number', () => {
            // Do not confuse these markedTrainedOn dates with the training-lapse stuff.
            // They are not related and are local to these tests where we check the marked trained behaviour.
            const markedTrainedOnOldNumberAt = faker.date.anytime();
            const markedTrainedOnNewNumberAt = faker.date.future({
              refDate: markedTrainedOnOldNumberAt,
            });

            beforeEach(async () => {
              jest.useFakeTimers();
              jest.setSystemTime(markedTrainedOnOldNumberAt);
              await markTrainedOnOldNumber();
            });
            userIsTrained(equipmentId, usersMembershipNumbers);
            if (!useExistingAccount) {
              describe('and the user is marked trained on the equipment on their new number', () => {
                beforeEach(async () => {
                  jest.setSystemTime(markedTrainedOnNewNumberAt);
                  await markTrainedOnNewNumber();
                });
                userIsTrained(equipmentId, usersMembershipNumbers);
                describe('the user shows as trained on their old date', () =>
                  testOnUsersNumbers(usersMembershipNumbers)(
                    membershipNumberToCheck =>
                      expectUserIsTrainedOnEquipmentAt(framework)(
                        membershipNumberToCheck,
                        equipmentId,
                        markedTrainedOnOldNumberAt
                      )
                  ));
              });
            }
          });
          // eslint-disable-next-line jest/no-commented-out-tests
          // describe('and the user passes a quiz on their old number', () => {
          //   beforeEach(() => quizPass(memberNumber, memberEmail));
          //   userIsAwaitingTraining(equipmentId, usersMembershipNumbers);
          // });
          // and they have left and then rejoined using their existing account › without actions prior to linking accounts › and the user passes a quiz on their old number › is shown as awaiting training › on their new number
          if (!useExistingAccount) {
            // eslint-disable-next-line jest/no-commented-out-tests
            // describe('and the user passes a quiz on their new number', () => {
            //   beforeEach(() => quizPass(newMemberNumber, memberEmail));
            //   userIsAwaitingTraining(equipmentId, usersMembershipNumbers);
            // eslint-disable-next-line jest/no-commented-out-tests
            //   describe('and the user is marked trained on equipment on their new number', () => {
            //     beforeEach(async () => {
            //       await markTrainedOnOldNumber();
            //     });
            //     userIsTrained(equipmentId, usersMembershipNumbers);
            //     userIsNotAwaitingTraining(equipmentId, usersMembershipNumbers);
            //   });
            // });
            describe('and the user is marked trained on equipment on their new number', () => {
              beforeEach(async () => {
                await markTrainedOnNewNumber();
              });
              userIsTrained(equipmentId, usersMembershipNumbers);
            });
          }
          describe('and then they are marked as an owner of an area on their old number', () => {
            beforeEach(() => markOwner(memberNumber));
            userIsOwner(areaId, usersMembershipNumbers);
            (useExistingAccount ? [true] : [true, false]).forEach(
              markTrainerOnOld => {
                describe(`and then they are marked as a trainer of a piece of equipment on their ${markTrainerOnOld ? 'old' : 'new'} number`, () => {
                  beforeEach(() =>
                    markTrainer(
                      markTrainerOnOld ? memberNumber : newMemberNumber
                    )
                  );
                  userIsTrainer(equipmentId, usersMembershipNumbers);
                });
              }
            );

            (useExistingAccount ? [true] : [true, false]).forEach(
              revokeOnOld => {
                describe(`and then they are removed as an owner of the area on their ${revokeOnOld ? 'old' : 'new'} number`, () => {
                  beforeEach(() =>
                    revokeOwner(revokeOnOld ? memberNumber : newMemberNumber)
                  );
                  userIsNotOwner(areaId, usersMembershipNumbers);
                });
              }
            );
          });
          if (!useExistingAccount) {
            describe('and then they are marked as an owner of an area on their new number', () => {
              beforeEach(() => markOwner(newMemberNumber));
              userIsOwner(areaId, usersMembershipNumbers);
              [true, false].forEach(markTrainerOnOld => {
                describe(`and then they are marked as a trainer of a piece of equipment on their ${markTrainerOnOld ? 'old' : 'new'} number`, () => {
                  beforeEach(() =>
                    markTrainer(
                      markTrainerOnOld ? memberNumber : newMemberNumber
                    )
                  );
                  userIsTrainer(equipmentId, usersMembershipNumbers);
                });
              });

              [true, false].forEach(revokeOnOld => {
                describe(`and then they are removed as an owner of the area on their ${revokeOnOld ? 'old' : 'new'} number`, () => {
                  beforeEach(() =>
                    revokeOwner(revokeOnOld ? memberNumber : newMemberNumber)
                  );
                  userIsNotOwner(areaId, usersMembershipNumbers);
                });
              });
            });
          }
        });

        describe('with actions prior to rejoining accounts', () => {
          const wasMemberWithOldNumberAt = faker.date.anytime();
          const membershipedStoppedAt = faker.date.soon({
            refDate: wasMemberWithOldNumberAt,
          });
          const rejoinedAt = faker.date.soon({
            refDate: membershipedStoppedAt,
          });

          describe('the user is marked trained on equipment on their old number', () => {
            beforeEach(async () => {
              // The user is marked trained on the old number before the linking.
              jest.useFakeTimers();
              jest.setSystemTime(wasMemberWithOldNumberAt);
              await markTrainedOnOldNumber();

              jest.setSystemTime(membershipedStoppedAt);
              await stopMembership(memberNumber);

              jest.setSystemTime(rejoinedAt);
              if (!useExistingAccount) {
                await createNewMemberRecord();
              }
              await markMemberRejoined();
            });
            userIsTrained(equipmentId, usersMembershipNumbers);
            describe('the user shows as trained on their old date', () =>
              testOnUsersNumbers(usersMembershipNumbers)(
                membershipNumberToCheck =>
                  expectUserIsTrainedOnEquipmentAt(framework)(
                    membershipNumberToCheck,
                    equipmentId,
                    wasMemberWithOldNumberAt
                  )
              ));
            describe('and then they rejoin as a member again', () => {
              const membershipStoppedAgainAt = faker.date.soon({
                refDate: rejoinedAt,
              });
              const rejoinedWithNewNumberAgainAt = faker.date.soon({
                refDate: membershipStoppedAgainAt,
              });
              const newestMemberNumber = faker.number.int({
                min: newMemberNumber + 1,
              }) as Int;
              const newestEmail = faker.internet.email() as EmailAddress;

              const usersMembershipNumbers: [string, Int][] = useExistingAccount
                ? [['old', memberNumber]]
                : [
                    ['old', memberNumber],
                    ['new', newMemberNumber],
                    ['newest', newestMemberNumber],
                  ];

              const createNewestMemberRecord = () =>
                framework.commands.memberNumbers.linkNumberToEmail({
                  memberNumber: newestMemberNumber,
                  email: newestEmail,
                  name: undefined,
                  formOfAddress: undefined,
                });

              const markMemberRejoinedAgain = useExistingAccount
                ? () =>
                    // In this case we are marking a member as having rejoined without creating them a new account.
                    framework.commands.memberNumbers.markMemberRejoinedWithExistingNumber(
                      {
                        memberNumber,
                      }
                    )
                : () =>
                    framework.commands.memberNumbers.markMemberRejoinedWithNewNumber(
                      {
                        oldMemberNumber: newMemberNumber,
                        newMemberNumber: newestMemberNumber,
                      }
                    );
              beforeEach(async () => {
                jest.setSystemTime(membershipStoppedAgainAt);
                await stopMembership(newMemberNumber);

                jest.setSystemTime(rejoinedWithNewNumberAgainAt);
                if (!useExistingAccount) {
                  await createNewestMemberRecord();
                }
                await markMemberRejoinedAgain();
              });
              userIsTrained(equipmentId, usersMembershipNumbers);
              describe('the user shows as trained on their old date', () =>
                testOnUsersNumbers(usersMembershipNumbers)(
                  membershipNumberToCheck =>
                    expectUserIsTrainedOnEquipmentAt(framework)(
                      membershipNumberToCheck,
                      equipmentId,
                      wasMemberWithOldNumberAt
                    )
                ));
            });
          });
          if (!useExistingAccount) {
            describe('the user is marked trained on equipment on their new number', () => {
              beforeEach(async () => {
                jest.useFakeTimers();
                jest.setSystemTime(wasMemberWithOldNumberAt);
                jest.setSystemTime(membershipedStoppedAt);
                await stopMembership(memberNumber);
                await createNewMemberRecord();
                await markTrainedOnNewNumber(); // Marked trained on the new number before the accounts were linked.
                jest.setSystemTime(rejoinedAt);
                await markMemberRejoined();
              });
              userIsTrained(equipmentId, usersMembershipNumbers);
            });
            describe('the user is marked trained on the equipment on their old number and new number', () => {
              beforeEach(async () => {
                jest.useFakeTimers();
                jest.setSystemTime(wasMemberWithOldNumberAt);
                await markTrainedOnOldNumber();
                jest.setSystemTime(membershipedStoppedAt);
                await stopMembership(memberNumber);
                if (!useExistingAccount) {
                  await createNewMemberRecord();
                }
                await markTrainedOnNewNumber();
                jest.setSystemTime(rejoinedAt);
                await markMemberRejoined();
              });
              userIsTrained(equipmentId, usersMembershipNumbers);
              describe('the user shows as trained on their old date', () =>
                testOnUsersNumbers(usersMembershipNumbers)(
                  membershipNumberToCheck =>
                    expectUserIsTrainedOnEquipmentAt(framework)(
                      membershipNumberToCheck,
                      equipmentId,
                      wasMemberWithOldNumberAt
                    )
                ));
            });
          }

          // eslint-disable-next-line jest/no-commented-out-tests
          // describe('the user completes a quiz on their old number + existing email', () => {
          //   beforeEach(async () => {
          //     jest.useFakeTimers();
          //     jest.setSystemTime(wasMemberWithOldNumberAt);
          //     quizPass(memberNumber, memberEmail);

          //     jest.setSystemTime(membershipedStoppedAt);
          //     await stopMembership(memberNumber);

          //     jest.setSystemTime(rejoinedAt);
          //     if (!useExistingAccount) {
          //       await createNewMemberRecord();
          //     }
          //     await markMemberRejoined();
          //   });
          //   userIsAwaitingTraining(equipmentId, usersMembershipNumbers);
          // });
          // if (!useExistingAccount) {
          //   // By adding another account into the mix there are more possibilities.
          // eslint-disable-next-line jest/no-commented-out-tests
          //   describe('the user completes a quiz on their old number + new email', () => {
          //     beforeEach(async () => {
          //       jest.useFakeTimers();
          //       jest.setSystemTime(wasMemberWithOldNumberAt);
          //       jest.setSystemTime(membershipedStoppedAt);
          //       await stopMembership(memberNumber);
          //       await createNewMemberRecord();
          //       quizPass(memberNumber, newEmail);

          //       jest.setSystemTime(rejoinedAt);
          //       await markMemberRejoined();
          //     });
          //     userIsAwaitingTraining(equipmentId, usersMembershipNumbers);
          //   });
          // eslint-disable-next-line jest/no-commented-out-tests
          //   describe('the user completes a quiz on their new number + existing email', () => {
          //     beforeEach(async () => {
          //       jest.useFakeTimers();
          //       jest.setSystemTime(wasMemberWithOldNumberAt);
          //       jest.setSystemTime(membershipedStoppedAt);
          //       await stopMembership(memberNumber);
          //       await createNewMemberRecord();
          //       quizPass(newMemberNumber, memberEmail);

          //       jest.setSystemTime(rejoinedAt);
          //       await markMemberRejoined();
          //     });
          //     userIsAwaitingTraining(equipmentId, usersMembershipNumbers);
          //   });
          // eslint-disable-next-line jest/no-commented-out-tests
          //   describe('the user completes a quiz on their new number + new email', () => {
          //     beforeEach(async () => {
          //       jest.useFakeTimers();
          //       jest.setSystemTime(wasMemberWithOldNumberAt);
          //       jest.setSystemTime(membershipedStoppedAt);
          //       await stopMembership(memberNumber);
          //       await createNewMemberRecord();
          //       quizPass(newMemberNumber, newEmail);

          //       jest.setSystemTime(rejoinedAt);
          //       await markMemberRejoined();
          //     });
          //     userIsAwaitingTraining(equipmentId, usersMembershipNumbers);
          //   });
          // }
          describe('the user is an owner of an area on their old number', () => {
            beforeEach(async () => {
              jest.useFakeTimers();
              jest.setSystemTime(wasMemberWithOldNumberAt);
              await markOwner(memberNumber);

              jest.setSystemTime(membershipedStoppedAt);
              await stopMembership(memberNumber);

              jest.setSystemTime(rejoinedAt);
              if (!useExistingAccount) {
                await createNewMemberRecord();
              }
              await markMemberRejoined();
            });
            userIsOwner(areaId, usersMembershipNumbers);
            describe('and then they are marked as a trainer of a piece of equipment on their old number', () => {
              beforeEach(() => markTrainer(memberNumber));
              userIsTrainer(equipmentId, usersMembershipNumbers);
            });
            if (!useExistingAccount) {
              describe('and then they are marked as a trainer of a piece of equipment on their new number', () => {
                beforeEach(() => markTrainer(newMemberNumber));
                userIsTrainer(equipmentId, usersMembershipNumbers);
              });
              describe('and then they are marked as an owner of the area on their new number', () => {
                beforeEach(() => markOwner(newMemberNumber));
                userIsOwner(areaId, usersMembershipNumbers); // User is still an owner.
              });
            }
            describe('and then they are removed as an owner of the area on their old number', () => {
              beforeEach(() => revokeOwner(memberNumber));
              userIsNotOwner(areaId, usersMembershipNumbers);
            });
            if (!useExistingAccount) {
              describe('and then they are removed as an owner of an area on their new number', () => {
                beforeEach(() => revokeOwner(newMemberNumber)); // Revoking at this point is taken as revoking for both because they were linked at the time.
                userIsNotOwner(areaId, usersMembershipNumbers);
              });
            }
          });
          describe('the user is a trainer on their old number', () => {
            beforeEach(async () => {
              jest.useFakeTimers();
              jest.setSystemTime(wasMemberWithOldNumberAt);
              await markOwner(memberNumber);
              await markTrainer(memberNumber);

              jest.setSystemTime(membershipedStoppedAt);
              await stopMembership(memberNumber);

              jest.setSystemTime(rejoinedAt);
              if (!useExistingAccount) {
                await createNewMemberRecord();
              }
              await markMemberRejoined();
            });
            userIsTrainer(equipmentId, usersMembershipNumbers);
          });
        });
      });
    });
  });

  describe('when a member is created including name + form of address', () => {
    const member = {
      memberNumber,
      email: memberEmail,
      name: 'Bob Beans',
      formOfAddress: 'he/him',
    };
    beforeEach(async () => {
      await framework.commands.memberNumbers.linkNumberToEmail(member);
    });

    const grabMember = () =>
      pipe(memberNumber, framework.sharedReadModel.members.get, getSomeOrFail);

    it('Member exists', () => expect(grabMember()).toBeDefined());

    it('Member has name set', () =>
      expect(getSomeOrFail(grabMember().name)).toStrictEqual(member.name));

    it('Member has form of address set', () =>
      expect(getSomeOrFail(grabMember().formOfAddress)).toStrictEqual(
        member.formOfAddress
      ));
  });
});
