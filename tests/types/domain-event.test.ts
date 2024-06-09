import * as t from 'io-ts';
import * as E from 'fp-ts/Either';
import {PathReporter} from 'io-ts/PathReporter';
import {DomainEvent} from '../../src/types/domain-event';

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
});
