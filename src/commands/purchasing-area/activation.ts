import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {constructEvent} from '../../types';
import {Command} from '../command';
import {isAdminOrSuperUser} from '../authentication-helpers/is-admin-or-super-user';
import {getPurchasingAreaOrFail} from './helpers';

// Turning a purchasing area on lets it take purchase requests and makes its
// budget live; turning it off stops new requests. Doing either to one that
// is already that way records nothing.

const codec = t.strict({
  purchasingAreaId: tt.UUID,
});

type SetPurchasingAreaActive = t.TypeOf<typeof codec>;

const settingActive = (
  active: boolean
): Command<SetPurchasingAreaActive> => ({
  process: input =>
    pipe(
      getPurchasingAreaOrFail(input.rm, input.command.purchasingAreaId),
      TE.map(purchasingArea =>
        purchasingArea.active === active
          ? O.none
          : O.some(
              constructEvent(
                active ? 'PurchasingAreaActivated' : 'PurchasingAreaDeactivated'
              )(input.command)
            )
      )
    ),
  decode: codec.decode,
  isAuthorized: isAdminOrSuperUser,
});

export const activate = settingActive(true);

export const deactivate = settingActive(false);
