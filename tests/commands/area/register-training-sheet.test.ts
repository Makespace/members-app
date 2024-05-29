import {v4} from 'uuid';
import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';
import * as O from 'fp-ts/Option';
import {create} from '../../../src/commands/area/create';
import {add} from '../../../src/commands/equipment/add'; 
import { registerTrainingSheet } from '../../../src/commands/equipment/register-training-sheet';

function createEquipment() {
    const areaName = faker.commerce.productName() as NonEmptyString;
    const areaDescription = faker.commerce.productDescription();
    const areaId = v4() as UUID;
    create.process({
      command: {
        id: areaId,
        name: areaName,
        description: areaDescription,
      },
      events: [],
    });
    const equipmentId = v4() as UUID;
    add.process({
        command: {
            id: equipmentId,
            name: faker.commerce.productName() as NonEmptyString,
            areaId,
        },
        events: [],
    });
    return equipmentId;
}

describe ('register-training-sheet', () => {
    describe('No training sheet, existing area already registered', () => {
        const equipmentId = createEquipment();
        const trainingSheetId = 'ABC=';
        const result = registerTrainingSheet.process({
            command: {
                equipmentId,
                trainingSheetId,
            },
            events: [],
        })
        it('Registers a new training sheet id', () => {
            expect(result).toStrictEqual(
                O.some(
                    expect.objectContaining({
                        type: 'EquipmentTrainingSheetRegistered',
                        equipmentId,
                        trainingSheetId,
                    })
                )
            )
        });
    });
});