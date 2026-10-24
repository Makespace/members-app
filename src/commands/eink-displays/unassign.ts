import * as t from 'io-ts';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {constructEvent} from '../../types';
import {Command} from '../command';
import {isAdminOrSuperUser} from '../authentication-helpers/is-admin-or-super-user';
import {DisplayNumberCodec} from '../../eink/display-number';

const codec = t.strict({
  displayNumber: DisplayNumberCodec,
});

type UnassignEinkDisplay = t.TypeOf<typeof codec>;

// Back to "not set up". A display that shows nothing has nothing to clear.
const process: Command<UnassignEinkDisplay>['process'] = input =>
  TE.right(
    O.isSome(input.rm.einkDisplays.get(input.command.displayNumber))
      ? O.some(constructEvent('EinkDisplayUnassigned')(input.command))
      : O.none
  );

export const unassign: Command<UnassignEinkDisplay> = {
  process,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
