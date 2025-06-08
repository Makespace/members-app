// import {faker} from '@faker-js/faker';
// import * as O from 'fp-ts/Option';
// import {DomainEvent} from '../../../src/types';
// import {TestFramework, initTestFramework} from '../test-framework';
// import {NonEmptyString, UUID} from 'io-ts-types';
// import {getAll} from '../../../src/read-models/equipment/get-all';

// describe('get-all', () => {
//   let events: ReadonlyArray<DomainEvent>;
//   let framework: TestFramework;
//   beforeEach(async () => {
//     framework = await initTestFramework();
//   });
//   afterEach(() => {
//     framework.eventStoreDb.close();
//   });

//   const createArea = {
//     id: faker.string.uuid() as UUID,
//     name: faker.company.buzzNoun() as NonEmptyString,
//     description: faker.company.buzzPhrase(),
//   };
//   const addEquipment = {
//     id: faker.string.uuid() as UUID,
//     name: faker.company.buzzNoun() as NonEmptyString,
//     areaId: createArea.id,
//   };
//   describe('when equipment is added to existing area', () => {
//     const createArea = {
//       id: faker.string.uuid() as UUID,
//       name: faker.company.buzzNoun() as NonEmptyString,
//     };
//     const addEquipment = {
//       id: faker.string.uuid() as UUID,
//       name: faker.company.buzzNoun() as NonEmptyString,
//       areaId: createArea.id,
//     };
//     beforeEach(async () => {
//       await framework.commands.area.create(createArea);
//       await framework.commands.equipment.add(addEquipment);
//       events = await framework.getAllEvents();
//     });

//     it('returns the equipment with the area name', () => {
//       const allEquipment = getAll(events);
//       expect(allEquipment[0].id).toStrictEqual(addEquipment.id);
//       expect(allEquipment[0].areaName).toStrictEqual(createArea.name);
//     });
//   });

//   describe('when equipment is added to non-existant area', () => {
//     const addEquipment = {
//       id: faker.string.uuid() as UUID,
//       name: faker.company.buzzNoun() as NonEmptyString,
//       areaId: faker.string.uuid() as UUID,
//     };
//     beforeEach(async () => {
//       await framework.commands.equipment.add(addEquipment);
//       events = await framework.getAllEvents();
//     });

//     it('omits the equipment', () => {
//       const allEquipment = getAll(events);
//       expect(allEquipment).toHaveLength(0);
//     });
//   });

//   describe('when equipment has no training sheet registered', () => {
//     beforeEach(async () => {
//       await framework.commands.area.create(createArea);
//       await framework.commands.equipment.add(addEquipment);
//       events = await framework.getAllEvents();
//     });
//     it('returns no training sheet', () => {
//       const allEquipment = getAll(events);
//       expect(allEquipment[0].trainingSheetId).toStrictEqual(O.none);
//     });
//   });

//   describe('when equipment has a training sheet registered', () => {
//     const registerSheet = {
//       equipmentId: addEquipment.id,
//       trainingSheetId: faker.string.alpha(8),
//     };
//     beforeEach(async () => {
//       await framework.commands.area.create(createArea);
//       await framework.commands.equipment.add(addEquipment);
//       await framework.commands.equipment.trainingSheet(registerSheet);
//       events = await framework.getAllEvents();
//     });

//     it('returns the sheet id', () => {
//       const allEquipment = getAll(events);
//       expect(allEquipment[0].trainingSheetId).toStrictEqual(
//         O.some(registerSheet.trainingSheetId)
//       );
//     });
//     describe('then the training sheet is revoked', () => {
//       const removeTrainingSheet = {
//         equipmentId: registerSheet.equipmentId,
//       };
//       beforeEach(async () => {
//         await framework.commands.equipment.removeTrainingSheet(
//           removeTrainingSheet
//         );
//       });
//       it('no longer returns a sheet id', () => {
//         const allEquipment = getAll(events);
//         expect(allEquipment[0].trainingSheetId).toStrictEqual(O.none);
//       });
//     });
//   });

//   describe('when equipment has had multiple sheets registered', () => {
//     const registerSheet = {
//       equipmentId: addEquipment.id,
//       trainingSheetId: faker.string.alpha(8),
//     };
//     const registerSheet2 = {
//       ...registerSheet,
//       trainingSheetId: faker.string.alpha(8),
//     };
//     expect(registerSheet.trainingSheetId).not.toEqual(
//       registerSheet2.trainingSheetId
//     );
//     beforeEach(async () => {
//       await framework.commands.area.create(createArea);
//       await framework.commands.equipment.add(addEquipment);
//       await framework.commands.equipment.trainingSheet(registerSheet);
//       await framework.commands.equipment.trainingSheet(registerSheet2);
//       events = await framework.getAllEvents();
//     });

//     it('returns the latest sheet id', () => {
//       // For the purposes of the system currently we take 'latest' to mean last sorted within the events
//       // which should be latest chronologically.
//       const allEquipment = getAll(events);
//       expect(allEquipment[0].trainingSheetId).toStrictEqual(
//         O.some(registerSheet2.trainingSheetId)
//       );
//     });
//   });
// });
