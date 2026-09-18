import * as E from 'fp-ts/Either';
import {pipe} from 'fp-ts/lib/function';
import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';
import {StatusCodes} from 'http-status-codes';
import {assignForm} from '../../../src/commands/trouble-tickets/action-form';
import {arbitraryUser} from '../../types/user.helper';
import { getTaskEitherRightOrFail} from '../../helpers';
import {TestFramework, initTestFramework} from '../../read-models/test-framework';

describe('trouble-ticket action form (assign)', () => {
  let framework: TestFramework;
  const areaId = faker.string.uuid() as UUID;
  const equipmentId = faker.string.uuid() as UUID;
  const ticketId = faker.string.uuid() as UUID;
  const trainer = arbitraryUser();
  const bystander = arbitraryUser();

  beforeEach(async () => {
    framework = await initTestFramework();
    for (const member of [trainer, bystander]) {
      await framework.commands.memberNumbers.linkNumberToEmail({
        memberNumber: member.memberNumber,
        email: member.emailAddress,
        name: undefined,
        formOfAddress: undefined,
      });
    }
    await framework.commands.area.create({
      id: areaId,
      name: 'Metal Shop' as NonEmptyString,
    });
    await framework.commands.equipment.add({
      id: equipmentId,
      name: 'Metal Lathe' as NonEmptyString,
      areaId,
    });
    await framework.commands.area.addOwner({
      areaId,
      memberNumber: trainer.memberNumber,
    });
    await framework.commands.trainers.add({
      equipmentId,
      memberNumber: trainer.memberNumber,
    });
    await framework.commands.troubleTickets.record({
      id: ticketId,
      rowHash: faker.string.alphanumeric(64) as NonEmptyString,
      sheetId: faker.string.alphanumeric(10) as NonEmptyString,
      submittedAt: faker.date.past(),
      submittedMemberNumber: null,
      submittedEmail: null,
      submittedName: null,
      submittedEquipment: 'Metal Lathe',
      otherEquipmentDetail: '',
      status: 'Down',
      attempting: '',
      issue: 'Sensitive submitter free text',
      steps: '',
    });
  });

  afterEach(() => {
    framework.close();
  });

  const constructFor = (user: typeof trainer, id: UUID) =>
    assignForm.constructForm({ticketId: id})({
      user,
      deps: framework.depsForCommands,
      readModel: framework.sharedReadModel,
    });

  it('shows the ticket to a trainer on its equipment', async () => {
    const viewModel = await getTaskEitherRightOrFail(
      constructFor(trainer, ticketId)
    );
    expect(viewModel.title).toBe('Sensitive submitter free text');
  });

  it('refuses a logged-in member with no claim on the ticket', async () => {
    const result = await constructFor(bystander, ticketId)();
    expect(result).toMatchObject(
      E.left({status: StatusCodes.FORBIDDEN})
    );
  });

  it('does not reveal whether a ticket id exists to the unauthorized', async () => {
    const result = await constructFor(
      bystander,
      faker.string.uuid() as UUID
    )();
    expect(result).toMatchObject(
      E.left({status: StatusCodes.FORBIDDEN})
    );
  });

  it('404s on an unknown ticket for an authorized viewer', async () => {
    await framework.commands.superUser.declare({
      memberNumber: trainer.memberNumber,
    });
    const result = await constructFor(
      trainer,
      faker.string.uuid() as UUID
    )();
    expect(result).toMatchObject(
      E.left({status: StatusCodes.NOT_FOUND})
    );
  });

  it('renders the confirmation form for the ticket', async () => {
    const viewModel = await getTaskEitherRightOrFail(
      constructFor(trainer, ticketId)
    );
    const page = pipe(viewModel, assignForm.renderForm);
    expect(page.body).toContain('Sensitive submitter free text');
    expect(page.body).toContain(ticketId);
  });
});
