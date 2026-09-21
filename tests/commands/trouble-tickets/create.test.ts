import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {UUID} from 'io-ts-types';
import {create} from '../../../src/commands/trouble-tickets/create';
import {
  arbitraryActor,
  getSomeOrFail,
  getTaskEitherRightOrFail,
} from '../../helpers';
import {TestFramework, initTestFramework} from '../../read-models/test-framework';

const arbitraryInput = () => ({
  id: faker.string.uuid() as UUID,
  submittedEquipment: null,
  submittedMemberNumber: null,
  submittedEmail: faker.internet.email(),
  submittedName: faker.person.fullName(),
  otherEquipmentDetail: '',
  status: 'Down',
  attempting: 'Seeding',
  issue: faker.lorem.sentence(),
  steps: '',
});

describe('create-trouble-ticket (seed/manual entry)', () => {
  let framework: TestFramework;

  beforeEach(async () => {
    framework = await initTestFramework();
  });

  afterEach(() => {
    framework.close();
  });

  it('emits a TroubleTicketCreated event with a generated rowHash', async () => {
    const input = arbitraryInput();
    const result = await getTaskEitherRightOrFail(
      create.process({
        command: {...input, actor: arbitraryActor()},
        rm: framework.sharedReadModel,
      })
    );

    const event = getSomeOrFail(result);
    expect(event).toMatchObject({
      type: 'TroubleTicketCreated',
      id: input.id,
      issue: input.issue,
      sheetId: 'manual',
      rowHash: expect.stringMatching(/^[0-9a-f]{64}$/) as string,
    });
  });

  it('is idempotent by id - re-running the same seed emits nothing', async () => {
    const input = arbitraryInput();
    await framework.commands.troubleTickets.create(input);

    const rerun = await getTaskEitherRightOrFail(
      create.process({
        command: {...input, actor: arbitraryActor()},
        rm: framework.sharedReadModel,
      })
    );

    expect(rerun).toStrictEqual(O.none);
    expect(framework.sharedReadModel.troubleTickets.getAll()).toHaveLength(1);
  });

  it('decodes the member number from a string (API convention)', () => {
    const decoded = create.decode({
      ...arbitraryInput(),
      submittedMemberNumber: '1234',
    });
    expect(decoded).toMatchObject({_tag: 'Right'});
  });
});
