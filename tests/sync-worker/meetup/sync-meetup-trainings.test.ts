import {
  isTraining,
  syncMeetupTrainings,
} from '../../../src/sync-worker/meetup/sync_meetup_trainings';
import {MeetupEvent} from '../../../src/sync-worker/meetup/fetch-meetup-events';
import {meetupTrainingTable} from '../../../src/sync-worker/meetup/meetup-training-table';
import {
  initTestFramework,
  TestFramework,
} from '../../read-models/test-framework';

const event = (id: string, title: string): MeetupEvent => ({
  id,
  title,
  startsAt: new Date('2026-11-03T18:00:00Z'),
  endsAt: new Date('2026-11-03T21:00:00Z'),
  url: `https://www.meetup.com/makespace/events/${id}/`,
  description: '',
  going: 2,
  maxTickets: 4,
  rsvpsClosed: false,
});

describe('pulling trainings from Meetup', () => {
  let framework: TestFramework;

  beforeEach(async () => {
    framework = await initTestFramework();
  });

  afterEach(() => {
    framework.close();
  });

  const deps = () => ({
    extDB: framework.extDB,
    logger: framework.depsForCommands.logger,
  });

  const cached = async () =>
    (await framework.extDB.select().from(meetupTrainingTable).all())
      .map(row => row.title)
      .sort();

  it.each([
    ['Metal Lathe Training', true],
    ['Festool domino training (Members only)', true],
    ['Trainer meet-up', true],
    ['Makespace Book Arts', false],
  ])('takes %j as a training: %s', (title, expected) => {
    expect(isTraining({title})).toBe(expected);
  });

  it('keeps only the trainings, replacing what was there', async () => {
    await syncMeetupTrainings(deps(), async () => [
      event('1', 'Metal Lathe Training'),
      event('2', 'Book Arts'),
    ]);
    expect(await cached()).toStrictEqual(['Metal Lathe Training']);

    await syncMeetupTrainings(deps(), async () => [
      event('3', 'Mitre Saw Induction Training'),
    ]);
    expect(await cached()).toStrictEqual(['Mitre Saw Induction Training']);
  });

  it('keeps the last good copy when Meetup cannot be reached', async () => {
    await syncMeetupTrainings(deps(), async () => [
      event('1', 'Metal Lathe Training'),
    ]);
    await syncMeetupTrainings(deps(), () =>
      Promise.reject(new Error('Meetup answered 503'))
    );
    expect(await cached()).toStrictEqual(['Metal Lathe Training']);
  });
});
