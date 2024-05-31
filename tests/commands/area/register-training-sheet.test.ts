import {v4} from 'uuid';
import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as RA from 'fp-ts/ReadonlyArray';
import {pipe} from 'fp-ts/lib/function';
import {create} from '../../../src/commands/area/create';
import {add} from '../../../src/commands/equipment/add'; 
import { registerTrainingSheet } from '../../../src/commands/equipment/register-training-sheet';
import { getAll } from '../../../src/read-models/equipment/get-all';
import { DomainEvent } from '../../../src/types';
import { Command } from '../../../src/commands';

function unwrap<T>(val: O.Option<T>): T {
    if (O.isSome(val)) {
        return val.value;
    }
    throw new Error('Failed to unwrap');
}

function callCommand<T> (func: Command<T>["process"], command: T) {
    return (events: ReadonlyArray<DomainEvent>) => {
        return RA.append(
            unwrap(func({
                command,
                events: RA.empty,
            }))
        )(events);
    }
}

function createEquipment(events: ReadonlyArray<DomainEvent>){
    const areaName = faker.commerce.productName() as NonEmptyString;
    const areaDescription = faker.commerce.productDescription();
    const areaId = v4() as UUID;
    const equipmentId = v4() as UUID;
    return {
        events: pipe(
            events,
            callCommand(create.process, {
                id: areaId,
                name: areaName,
                description: areaDescription,
            }),
            callCommand(add.process, {
                id: equipmentId,
                name: faker.commerce.productName() as NonEmptyString,
                areaId: areaId,
            }),
        ),
        equipmentId,
    };
}

describe ('register-training-sheet', () => {
    describe('No training sheet, existing area already registered', () => {
        const {events, equipmentId} = createEquipment(RA.empty);
        const trainingSheetId = 'ABC=';
        const eventsAfter = callCommand(registerTrainingSheet.process, {
            equipmentId,
            trainingSheetId,
        })(events);
        it('Registers a new training sheet id', () => {
            const registerEvents = eventsAfter.filter(event => event.type === 'EquipmentTrainingSheetRegistered');
            expect(registerEvents).toHaveLength(1);
            expect(registerEvents[0]).toStrictEqual(
                expect.objectContaining({
                    type: 'EquipmentTrainingSheetRegistered',
                    equipmentId,
                    trainingSheetId,
                })
            )
        });
        it('The new training sheet id appears when getting equipment', () => {
            const equipment = getAll(eventsAfter);
            console.log(equipment);
            expect(equipment[0]).toHaveProperty('trainingSheetId', O.some(trainingSheetId));
        });
    });
});