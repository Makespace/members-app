import { faker } from "@faker-js/faker";
import { processEvents, run } from "../../src/training-sheets/training-sheets-worker";
import { DomainEvent } from "../../src/types";
import { happyPathAdapters } from "../init-dependencies/happy-path-adapters.helper";
import { TestFramework, initTestFramework } from "../read-models/test-framework";
import { NonEmptyString, UUID } from "io-ts-types";

describe('Training sheets worker', () => {
    let events: ReadonlyArray<DomainEvent>;
    let framework: TestFramework;
    beforeEach(async () => {
        framework = await initTestFramework();
    });
    
    describe('Process events', () => {
        const createArea = {
            id: faker.string.uuid() as UUID,
            name: faker.company.buzzNoun() as NonEmptyString,
        };
        const addEquipment = {
            id: faker.string.uuid() as UUID,
            name: faker.company.buzzNoun() as NonEmptyString,
            areaId: createArea.id,
        };
        const registerTrainingSheet = {
            equipmentId: addEquipment.id,
            trainingSheetId: faker.string.uuid(),
        };
        beforeEach(async () => {
            await framework.commands.area.create(createArea);
            await framework.commands.equipment.add(addEquipment);
            await framework.commands.equipment.training_sheet(registerTrainingSheet);
            events = await framework.getAllEvents();
        });

        it('Processes a registered training sheet', () => {
            const result = processEvents(happyPathAdapters, happyPathAdapters.logger)(events);
        });
    });
});