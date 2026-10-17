import {faker} from '@faker-js/faker';
import {Int} from 'io-ts';
import {NonEmptyString, UUID} from 'io-ts-types';
import {constructViewModel} from '../../../src/queries/equipment/construct-view-model';
import {arbitraryUser} from '../../types/user.helper';
import {getRightOrFail, insertRecurlySubscription} from '../../helpers';
import {
  TestFramework,
  initTestFramework,
} from '../../read-models/test-framework';

// The numbers on the cards answer "is anything happening with this machine?",
// so they have to count things that actually happened.
describe('the counts on a machine of its tickets', () => {
  let framework: TestFramework;
  const areaId = faker.string.uuid() as UUID;
  const equipmentId = faker.string.uuid() as UUID;
  const owner = arbitraryUser();

  const ticket = (issue: string) => ({
    id: faker.string.uuid() as UUID,
    rowHash: faker.string.alphanumeric(64) as NonEmptyString,
    sheetId: faker.string.alphanumeric(10) as NonEmptyString,
    submittedAt: new Date(),
    submittedMemberNumber: null,
    submittedEmail: null,
    submittedName: null,
    submittedEquipment: 'Band Saw',
    otherEquipmentDetail: '',
    status: 'Down',
    attempting: '',
    issue,
    steps: '',
  });

  const counts = async () =>
    getRightOrFail(
      await constructViewModel(framework.depsForCommands, owner)(equipmentId)()
    ).tickets;

  const ticketIds = () =>
    framework.sharedReadModel.troubleTickets
      .getAll()
      .map(found => found.id);

  beforeEach(async () => {
    framework = await initTestFramework();
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: owner.memberNumber,
      email: owner.emailAddress,
      name: undefined,
      formOfAddress: undefined,
    });
    await framework.commands.area.create({
      id: areaId,
      name: 'Wood Shop' as NonEmptyString,
    });
    await framework.commands.equipment.add({
      id: equipmentId,
      name: 'Band Saw' as NonEmptyString,
      areaId,
    });
    await framework.commands.area.addOwner({
      areaId,
      memberNumber: owner.memberNumber,
    });
  });

  afterEach(() => {
    framework.close();
  });

  it('counts the tickets nobody has dealt with yet', async () => {
    await framework.commands.troubleTickets.record(ticket('Blade is blunt'));
    await framework.commands.troubleTickets.record(ticket('Guard is loose'));

    expect((await counts()).active).toBe(2);
  });

  it('counts a resolution somebody was told about', async () => {
    await framework.commands.troubleTickets.record(ticket('Blade is blunt'));
    await framework.commands.troubleTickets.resolve({
      ticketId: ticketIds()[0],
      summary: 'New blade fitted',
      quiet: false,
    });

    const result = await counts();
    expect(result.resolvedRecently).toBe(1);
    expect(result.active).toBe(0);
  });

  // The historic backlog was closed this way: counting those would say a
  // machine is being looked after when its old tickets were merely tidied up.
  it('leaves a quiet resolution out of the count', async () => {
    await framework.commands.troubleTickets.record(ticket('Blade is blunt'));
    await framework.commands.troubleTickets.resolve({
      ticketId: ticketIds()[0],
      summary: '',
      quiet: true,
    });

    const result = await counts();
    expect(result.resolvedRecently).toBe(0);
    // It is still resolved, so it is no longer active either.
    expect(result.active).toBe(0);
  });

  it('counts trainings on the machine, not on others', async () => {
    const trainee = arbitraryUser();
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: trainee.memberNumber,
      email: trainee.emailAddress,
      name: undefined,
      formOfAddress: undefined,
    });
    await framework.commands.trainers.markTrained({
      equipmentId,
      memberNumber: trainee.memberNumber as Int,
    });

    const view = getRightOrFail(
      await constructViewModel(framework.depsForCommands, owner)(equipmentId)()
    );

    expect(view.training.trainingsRecently).toBe(1);
  });
});

// "Members waiting for training" comes from the same quiz data as the
// quiz-results page: passed the quiz, not yet trained, still a member.
describe('the count of members waiting for training', () => {
  let framework: TestFramework;
  const areaId = faker.string.uuid() as UUID;
  const equipmentId = faker.string.uuid() as UUID;
  const trainingSheetId = faker.string.alphanumeric(20) as NonEmptyString;
  const owner = arbitraryUser();
  const trainee = arbitraryUser();

  const waitingForTraining = async () =>
    getRightOrFail(
      await constructViewModel(framework.depsForCommands, owner)(equipmentId)()
    ).training.waitingForTraining;

  const passQuiz = (memberNumber: number, email: string, completedAt = new Date()) =>
    framework.commands.trainingQuiz.record({
      trainingSheetId,
      completedAt,
      memberNumberProvided: memberNumber,
      emailProvided: email,
      score: 10 as Int,
      maxScore: 10 as Int,
      rowHash: faker.string.uuid() as NonEmptyString,
    });

  beforeEach(async () => {
    framework = await initTestFramework();
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: owner.memberNumber,
      email: owner.emailAddress,
      name: undefined,
      formOfAddress: undefined,
    });
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: trainee.memberNumber,
      email: trainee.emailAddress,
      name: undefined,
      formOfAddress: undefined,
    });
    await framework.commands.area.create({
      id: areaId,
      name: 'Wood Shop' as NonEmptyString,
    });
    await framework.commands.equipment.add({
      id: equipmentId,
      name: 'Band Saw' as NonEmptyString,
      areaId,
    });
    await framework.commands.area.addOwner({
      areaId,
      memberNumber: owner.memberNumber,
    });
    await framework.commands.equipment.trainingSheet({
      equipmentId,
      trainingSheetId,
    });
  });

  afterEach(() => {
    framework.close();
  });

  it('is zero when nobody has passed the quiz', async () => {
    expect(await waitingForTraining()).toBe(0);
  });

  it('counts a member who passed the quiz, once even if they passed twice', async () => {
    await passQuiz(trainee.memberNumber, trainee.emailAddress);
    await passQuiz(trainee.memberNumber, trainee.emailAddress);

    expect(await waitingForTraining()).toBe(1);
  });

  it('stops counting a member once they are marked as trained', async () => {
    await passQuiz(trainee.memberNumber, trainee.emailAddress);
    await framework.commands.trainers.markTrained({
      equipmentId,
      memberNumber: trainee.memberNumber as Int,
    });

    expect(await waitingForTraining()).toBe(0);
  });

  it('does not count a failed quiz', async () => {
    await framework.commands.trainingQuiz.record({
      trainingSheetId,
      completedAt: new Date(),
      memberNumberProvided: trainee.memberNumber,
      emailProvided: trainee.emailAddress,
      score: 5 as Int,
      maxScore: 10 as Int,
      rowHash: faker.string.uuid() as NonEmptyString,
    });

    expect(await waitingForTraining()).toBe(0);
  });

  it('counts a passed quiz whose member number is not linked to an account', async () => {
    await passQuiz(999999, 'whoever@example.com');

    expect(await waitingForTraining()).toBe(1);
  });

  it('does not count somebody who is no longer a member', async () => {
    await passQuiz(trainee.memberNumber, trainee.emailAddress);
    await insertRecurlySubscription(framework.extDB, {
      email: trainee.emailAddress,
      hasActiveSubscription: false,
    });

    expect(await waitingForTraining()).toBe(0);
  });
});
