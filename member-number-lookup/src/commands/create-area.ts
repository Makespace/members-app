import {DomainEvent, constructEvent, isEventOfType} from '../types';
import * as RA from 'fp-ts/ReadonlyArray';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {Command} from '../types/command';

const codec = t.strict({
  name: tt.NonEmptyString,
  description: t.string,
});

type CreateArea = t.TypeOf<typeof codec>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const handle = (input: {
  command: CreateArea;
  events: ReadonlyArray<DomainEvent>;
}): O.Option<DomainEvent> => O.none;

export const createArea: Command<CreateArea> = {
  process: handle,
  decode: codec.decode,
};
