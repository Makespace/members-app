import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';
import {StatusCodes} from 'http-status-codes';
import {assign} from '../../../src/commands/eink-displays/assign';
import {unassign} from '../../../src/commands/eink-displays/unassign';
import {
  arbitraryActor,
  getLeftOrFail,
  getSomeOrFail,
  getTaskEitherRightOrFail,
} from '../../helpers';
import {
  initTestFramework,
  TestFramework,
} from '../../read-models/test-framework';

describe('choosing what an e-ink display shows', () => {
  const equipmentId = faker.string.uuid() as UUID;

  describe('the display number', () => {
    it.each([
      ['1', 1],
      ['999', 999],
      [3, 3],
    ])('accepts %j', (displayNumber, expected) => {
      expect(assign.decode({displayNumber, equipmentId})).toStrictEqual(
        E.right({displayNumber: expected, equipmentId})
      );
    });

    it.each([['0'], ['1000'], ['-1'], ['1.5'], ['1e2'], [' 3'], [''], [0], [2.5]])(
      'rejects %j',
      displayNumber => {
        expect(E.isLeft(assign.decode({displayNumber, equipmentId}))).toBe(
          true
        );
        expect(E.isLeft(unassign.decode({displayNumber}))).toBe(true);
      }
    );
  });

  describe('against the read model', () => {
    let framework: TestFramework;
    const areaId = faker.string.uuid() as UUID;
    const otherEquipmentId = faker.string.uuid() as UUID;

    beforeEach(async () => {
      framework = await initTestFramework();
      await framework.commands.area.create({
        id: areaId,
        name: 'Wood Shop' as NonEmptyString,
      });
      await framework.commands.equipment.add({
        id: equipmentId,
        name: 'Band Saw' as NonEmptyString,
        areaId,
      });
      await framework.commands.equipment.add({
        id: otherEquipmentId,
        name: 'Table Saw' as NonEmptyString,
        areaId,
      });
    });

    afterEach(() => {
      framework.close();
    });

    const processAssign = (displayNumber: number, onEquipment: UUID) =>
      assign.process({
        command: {displayNumber, equipmentId: onEquipment, actor: arbitraryActor()},
        rm: framework.sharedReadModel,
      });

    it('records the display showing the machine', async () => {
      const event = getSomeOrFail(
        await getTaskEitherRightOrFail(processAssign(1, equipmentId))
      );
      expect(event).toMatchObject({
        type: 'EinkDisplayAssigned',
        displayNumber: 1,
        equipmentId,
      });
    });

    it('refuses a machine that does not exist', async () => {
      const failure = getLeftOrFail(
        await processAssign(1, faker.string.uuid() as UUID)()
      );
      expect(failure.status).toStrictEqual(StatusCodes.NOT_FOUND);
    });

    it('records nothing when the display already shows that machine', async () => {
      await framework.commands.einkDisplays.assign({
        displayNumber: 1,
        equipmentId,
      });
      expect(
        await getTaskEitherRightOrFail(processAssign(1, equipmentId))
      ).toStrictEqual(O.none);
    });

    it('moves a display from one machine to another', async () => {
      await framework.commands.einkDisplays.assign({
        displayNumber: 1,
        equipmentId,
      });
      await framework.commands.einkDisplays.assign({
        displayNumber: 1,
        equipmentId: otherEquipmentId,
      });
      expect(framework.sharedReadModel.einkDisplays.get(1)).toStrictEqual(
        O.some(otherEquipmentId)
      );
    });

    it('lets two displays show the same machine', async () => {
      await framework.commands.einkDisplays.assign({
        displayNumber: 2,
        equipmentId,
      });
      await framework.commands.einkDisplays.assign({
        displayNumber: 1,
        equipmentId,
      });
      expect(framework.sharedReadModel.einkDisplays.getAll()).toStrictEqual([
        {displayNumber: 1, equipmentId},
        {displayNumber: 2, equipmentId},
      ]);
    });

    describe('clearing a display', () => {
      const processUnassign = (displayNumber: number) =>
        unassign.process({
          command: {displayNumber, actor: arbitraryActor()},
          rm: framework.sharedReadModel,
        });

      it('leaves it showing nothing', async () => {
        await framework.commands.einkDisplays.assign({
          displayNumber: 1,
          equipmentId,
        });
        await framework.commands.einkDisplays.unassign({displayNumber: 1});
        expect(framework.sharedReadModel.einkDisplays.get(1)).toStrictEqual(
          O.none
        );
      });

      it('records nothing for a display that shows nothing', async () => {
        expect(
          await getTaskEitherRightOrFail(processUnassign(1))
        ).toStrictEqual(O.none);
      });
    });
  });

  describe('who may', () => {
    let framework: TestFramework;

    beforeEach(async () => {
      framework = await initTestFramework();
    });

    afterEach(() => {
      framework.close();
    });

    it('is not a member who is not a super-user', () => {
      const actor = {
        tag: 'user' as const,
        user: {
          memberNumber: faker.number.int(),
          emailAddress: faker.internet.email() as never,
        },
      };
      const input = {displayNumber: 1, equipmentId};
      expect(
        assign.isAuthorized({actor, rm: framework.sharedReadModel, input})
      ).toBe(false);
      expect(
        unassign.isAuthorized({
          actor,
          rm: framework.sharedReadModel,
          input: {displayNumber: 1},
        })
      ).toBe(false);
    });
  });
});
