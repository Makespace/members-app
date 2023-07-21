import {DomainEvent} from '../../types';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';

const codec = t.strict({
  memberNumber: tt.NumberFromString,
});

type DeclareSuperUserCommand = t.TypeOf<typeof codec>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const handle = (input: {
  command: DeclareSuperUserCommand;
  events: ReadonlyArray<DomainEvent>;
}): O.Option<DomainEvent> => O.none;

export const declareSuperUser = {
  process: handle,
  decode: codec.decode,
};
