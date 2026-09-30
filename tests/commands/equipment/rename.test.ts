import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';
import {rename} from '../../../src/commands/equipment/rename';
import {getSomeOrFail, getTaskEitherRightOrFail} from '../../helpers';
import {
  TestFramework,
  initTestFramework,
} from '../../read-models/test-framework';
import {arbitraryActor} from '../../helpers';

describe('renaming a machine', () => {
  describe('what the form is allowed to send', () => {
    const equipmentId = faker.string.uuid() as UUID;
    const decode = (name: string) => rename.decode({equipmentId, name});

    it('accepts a name', () => {
      expect(decode('Bandsaw')).toStrictEqual(
        E.right({equipmentId, name: 'Bandsaw'})
      );
    });

    it('trims what was typed', () => {
      expect(decode('  Bandsaw  ')).toStrictEqual(
        E.right({equipmentId, name: 'Bandsaw'})
      );
    });

    it.each([[''], ['   '], ['\t']])(
      'refuses %p, which is not a name',
      value => {
        expect(E.isLeft(decode(value))).toBe(true);
      }
    );
  });

  describe('against the read model', () => {
    let framework: TestFramework;
    const equipmentId = faker.string.uuid() as UUID;
    const areaId = faker.string.uuid() as UUID;

    beforeEach(async () => {
      framework = await initTestFramework();
      await framework.commands.area.create({
        id: areaId,
        name: faker.company.buzzNoun() as NonEmptyString,
      });
      await framework.commands.equipment.add({
        id: equipmentId,
        name: 'Band Saw' as NonEmptyString,
        areaId,
      });
    });
    afterEach(() => framework.close());

    it('records the new name and what it was called before', async () => {
      const event = getSomeOrFail(
        await getTaskEitherRightOrFail(
          rename.process({
            command: {equipmentId, name: 'Bandsaw', actor: arbitraryActor()},
            rm: framework.sharedReadModel,
          })
        )
      );
      expect(event).toMatchObject({
        type: 'EquipmentNameChanged',
        equipmentId,
        name: 'Bandsaw',
        previousName: 'Band Saw',
      });
    });

    it('does nothing when the name is unchanged', async () => {
      const result = await getTaskEitherRightOrFail(
        rename.process({
          command: {equipmentId, name: 'Band Saw', actor: arbitraryActor()},
          rm: framework.sharedReadModel,
        })
      );
      expect(result).toStrictEqual(O.none);
    });

    it('shows the new name once applied', async () => {
      await framework.commands.equipment.rename({
        equipmentId,
        name: 'Bandsaw',
      });
      expect(
        getSomeOrFail(framework.sharedReadModel.equipment.get(equipmentId)).name
      ).toBe('Bandsaw');
    });

    // The whole point of carrying the old name on the event. A form that still
    // offers the previous label - or a report written before the rename - must
    // not land in Unassigned.
    const ticketNaming = async (submittedEquipment: string) => {
      const id = faker.string.uuid() as UUID;
      await framework.commands.troubleTickets.record({
        id,
        rowHash: faker.string.uuid() as NonEmptyString,
        sheetId: 'sheet' as NonEmptyString,
        submittedAt: new Date(),
        submittedMemberNumber: null,
        submittedEmail: null,
        submittedName: null,
        submittedEquipment,
        otherEquipmentDetail: '',
        status: '',
        attempting: '',
        issue: 'It is broken',
        steps: '',
      });
      return getSomeOrFail(framework.sharedReadModel.troubleTickets.getById(id));
    };

    it('still matches a ticket that uses the old name', async () => {
      await framework.commands.equipment.rename({
        equipmentId,
        name: 'Bandsaw',
      });
      expect((await ticketNaming('Band Saw')).equipmentId).toBe(equipmentId);
    });

    it('matches a ticket that uses the new name', async () => {
      await framework.commands.equipment.rename({
        equipmentId,
        name: 'Bandsaw',
      });
      expect((await ticketNaming('Bandsaw')).equipmentId).toBe(equipmentId);
    });
  });
});
