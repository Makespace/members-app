import * as t from 'io-ts';
import * as E from 'fp-ts/Either';
import {PathReporter} from 'io-ts/PathReporter';
import {DomainEvent, StoredDomainEvent} from '../../src/types/domain-event';
import { DateTime } from 'luxon';

function unwrap<L extends t.Errors, R>(e: E.Either<L, R>): R {
  if (E.isRight(e)) {
    return e.right;
  }
  throw Error(PathReporter.report(e).join('\n'));
}

describe('DomainEvent', () => {
  it('validates AreaCreated events', () => {
    const event: unknown = {
      type: 'AreaCreated',
      actor: {tag: 'system'},
      recordedAt: '1991-02-20T00:00:00.000Z',
      name: 'Craft room',
      id: 'd1428735-0482-49c4-b16b-82503ccea74b',
    };

    const decoded = unwrap(DomainEvent.decode(event));
    expect(decoded).toEqual({
      actor: {tag: 'system'},
      id: 'd1428735-0482-49c4-b16b-82503ccea74b',
      name: 'Craft room',
      recordedAt: new Date(1991, 1, 20),
      type: 'AreaCreated',
    });
  });

  it('validates MemberDetailsUpdated', () => {
    const event: unknown = {
      type: 'MemberDetailsUpdated',
      actor: {tag: 'system'},
      recordedAt: '1991-02-20T00:00:00.000Z',
      memberNumber: 1337,
      name: 'Molly Millions',
    };

    const decoded = unwrap(DomainEvent.decode(event));
    expect(decoded).toEqual({
      type: 'MemberDetailsUpdated',
      actor: {tag: 'system'},
      recordedAt: new Date(1991, 1, 20),
      memberNumber: 1337,
      name: 'Molly Millions',
    });
  });

  it('validates stored events with event ids', () => {
    const event: unknown = {
      event_index: 1,
      event_id: 'cb5bdc6d-f734-43e2-a025-b5d89a5ba3fc',
      type: 'AreaCreated',
      actor: {tag: 'system'},
      recordedAt: '1991-02-20T00:00:00.000Z',
      name: 'Craft room',
      id: 'd1428735-0482-49c4-b16b-82503ccea74b',
      deletedAt: null,
      deleteReason: null,
      markDeletedByMemberNumber: null,
    };

    const decoded = unwrap(StoredDomainEvent.decode(event));
    expect(decoded).toEqual({
      event_index: 1,
      event_id: 'cb5bdc6d-f734-43e2-a025-b5d89a5ba3fc',
      actor: {tag: 'system'},
      id: 'd1428735-0482-49c4-b16b-82503ccea74b',
      name: 'Craft room',
      recordedAt: new Date(1991, 1, 20),
      type: 'AreaCreated',
      deletedAt: null,
      deleteReason: null,
      markDeletedByMemberNumber: null,
    });
  });

  it('validates deleted stored event', () => {
    const event: unknown = {
      event_index: 1,
      event_id: 'cb5bdc6d-f734-43e2-a025-b5d89a5ba3fc',
      type: 'AreaCreated',
      actor: {tag: 'system'},
      recordedAt: '1991-02-20T00:00:00.000Z',
      name: 'Craft room',
      id: 'd1428735-0482-49c4-b16b-82503ccea74b',
      deletedAt: 1777885645917,
      deleteReason: 'Hello world',
      markDeletedByMemberNumber: 1233,
    };

    const decoded = unwrap(StoredDomainEvent.decode(event));
    expect(decoded).toEqual({
      event_index: 1,
      event_id: 'cb5bdc6d-f734-43e2-a025-b5d89a5ba3fc',
      actor: {tag: 'system'},
      id: 'd1428735-0482-49c4-b16b-82503ccea74b',
      name: 'Craft room',
      recordedAt: new Date(1991, 1, 20),
      type: 'AreaCreated',
      deletedAt:  DateTime.utc(
        2026,
        5,
        4,
        9,
        7,
        25,
        917,
      ).toJSDate(),
      deleteReason: 'Hello world',
      markDeletedByMemberNumber: 1233,
    });
  });
});
