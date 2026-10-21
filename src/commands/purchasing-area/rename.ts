import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {constructEvent} from '../../types';
import {Command} from '../command';
import {isAdminOrSuperUser} from '../authentication-helpers/is-admin-or-super-user';
import {getPurchasingAreaOrFail} from './helpers';

const codec = t.strict({
  purchasingAreaId: tt.UUID,
  name: tt.NonEmptyString,
});

type RenamePurchasingArea = t.TypeOf<typeof codec>;

const process: Command<RenamePurchasingArea>['process'] = input =>
  pipe(
    getPurchasingAreaOrFail(input.rm, input.command.purchasingAreaId),
    TE.map(purchasingArea =>
      purchasingArea.name === input.command.name
        ? O.none
        : O.some(constructEvent('PurchasingAreaRenamed')(input.command))
    )
  );

export const rename: Command<RenamePurchasingArea> = {
  process,
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
};
