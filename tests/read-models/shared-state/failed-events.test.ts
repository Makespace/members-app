import {faker} from '@faker-js/faker';
import {UUID} from 'io-ts-types';
import {failedEventsTable} from '../../../src/read-models/shared-state/state';
import {constructEvent, EmailAddress} from '../../../src/types';
import {arbitraryActor, getSomeOrFail} from '../../helpers';
import {initTestFramework, TestFramework} from '../test-framework';
import { Int } from 'io-ts';
import * as O from 'fp-ts/Option';
import { allMemberNumbers } from '../../../src/read-models/shared-state/return-types';

const arbitraryLinkNumberEvent = () => ({
  type: 'MemberNumberLinkedToEmail' as const,
  actor: arbitraryActor(),
  recordedAt: new Date(),
  memberNumber: faker.number.int(),
  email: faker.internet.email() as EmailAddress,
  name: undefined,
  formOfAddress: undefined,
});

const arbitraryFailingOwnerAddedEvent = () => ({
  type: 'OwnerAdded' as const,
  actor: arbitraryActor(),
  recordedAt: new Date(),
  memberNumber: faker.number.int(),
  areaId: faker.string.uuid() as UUID,
});

describe('failed-events', () => {
  let framework: TestFramework;

  beforeEach(async () => {
    framework = await initTestFramework();
  });

  afterEach(() => {
    framework.close();
  });

  it('records tracked events that fail to apply', () => {
    const failedEvent = framework.insertIntoSharedReadModel(
      arbitraryFailingOwnerAddedEvent()
    );

    const rows = framework.sharedReadModel.db
      .select()
      .from(failedEventsTable)
      .all();

    expect(framework.sharedReadModel.getCurrentEventIndex()).toStrictEqual(
      failedEvent.event_index
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].error).toContain(
      'Unable to add owner, unknown member number'
    );
    expect(rows[0].eventId).toStrictEqual(failedEvent.event_id);
    expect(rows[0].eventIndex).toStrictEqual(failedEvent.event_index);
    expect(rows[0].eventType).toStrictEqual(failedEvent.type);
    expect(rows[0].payload).toStrictEqual(
      expect.objectContaining({
        event_id: failedEvent.event_id,
        event_index: failedEvent.event_index,
        type: 'OwnerAdded',
      })
    );
  });

  it("doesn't duplicate a failed event when applied more than once", () => {
    const failedEvent = framework.insertIntoSharedReadModel(
      arbitraryFailingOwnerAddedEvent()
    );

    framework.sharedReadModel.updateState(failedEvent);

    const rows = framework.sharedReadModel.db
      .select()
      .from(failedEventsTable)
      .all();

    expect(rows).toHaveLength(1);
    expect(rows[0].eventId).toStrictEqual(failedEvent.event_id);
  });

  it('continues applying later tracked events after a failure', () => {
    framework.insertIntoSharedReadModel(arbitraryFailingOwnerAddedEvent());
    const successfulEvent = framework.insertIntoSharedReadModel(
      arbitraryLinkNumberEvent()
    );

    expect(framework.sharedReadModel.getCurrentEventIndex()).toStrictEqual(
      successfulEvent.event_index
    );
    expect(framework.sharedReadModel.members.getAll()).toHaveLength(1);
    expect(
      framework.sharedReadModel.db.select().from(failedEventsTable).all()
    ).toHaveLength(1);
  });

  it('records a failed event when a rejoin links to an unknown old member number', () => {
    const oldMemberNumber = faker.number.int() as Int;
    const newMemberNumber = oldMemberNumber + 1;
    const newMember = arbitraryLinkNumberEvent();

    framework.insertIntoSharedReadModel({
      ...newMember,
      memberNumber: newMemberNumber,
    });
    framework.insertIntoSharedReadModel(
      constructEvent('MemberRejoinedWithNewNumber')({
        oldMemberNumber,
        newMemberNumber,
        actor: arbitraryActor(),
      })
    );

    const rows = framework.sharedReadModel.db
      .select()
      .from(failedEventsTable)
      .all();

    expect(rows).toHaveLength(1);
    expect(rows[0].error).toContain('unknown existing user');
    expect(
      framework.sharedReadModel.members.getByMemberNumber(oldMemberNumber)
    ).toStrictEqual(O.none);
    expect(
      allMemberNumbers(getSomeOrFail(
        framework.sharedReadModel.members.getByMemberNumber(newMemberNumber)
      ))
    ).toStrictEqual([newMemberNumber]);
  });

  it('records a failed event when a rejoin uses an older new member number', () => {
    const oldMemberNumber = faker.number.int({min: 2});
    const newMemberNumber = oldMemberNumber - 1;

    [oldMemberNumber, newMemberNumber].forEach(memberNumber => {
      framework.insertIntoSharedReadModel({
        ...arbitraryLinkNumberEvent(),
        memberNumber,
      });
    });
    framework.insertIntoSharedReadModel(
      constructEvent('MemberRejoinedWithNewNumber')({
        oldMemberNumber,
        newMemberNumber,
        actor: arbitraryActor(),
      })
    );

    const rows = framework.sharedReadModel.db
      .select()
      .from(failedEventsTable)
      .all();

    expect(rows).toHaveLength(1);
    expect(rows[0].error).toContain('old number is later than new number');
    expect(
      allMemberNumbers(
        getSomeOrFail(
          framework.sharedReadModel.members.getByMemberNumber(oldMemberNumber)
        )
      )
    ).toStrictEqual([oldMemberNumber]);
    expect(
      allMemberNumbers(
        getSomeOrFail(
          framework.sharedReadModel.members.getByMemberNumber(newMemberNumber)
        )
      )
    ).toStrictEqual([newMemberNumber]);
  });
});
