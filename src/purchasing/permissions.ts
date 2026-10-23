import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {Actor} from '../types';
import {SharedReadModel} from '../read-models/shared-state';
import {
  allMemberNumbers,
  PurchaseRequest,
  PurchasingArea,
} from '../read-models/shared-state/return-types';
import {isAdminOrSuperUser} from '../commands/authentication-helpers/is-admin-or-super-user';
import {BuyerRole} from './buy-directly';

// Who can do what with a purchasing area's purchase requests.
//
// - Owners of its areas (and its purchasers and super users) can request a
//   purchase. Other members raise a trouble ticket instead.
// - A request that needs no proposal needs purchaser approval: any of the
//   area's purchasers, including whoever sent it, or a super user.
// - One that needs a proposal needs director approval: super users only.
// - A purchaser counts only while they still own one of its areas.

const memberNumberOf = (actor: Actor) =>
  actor.tag === 'user' ? O.some(actor.user.memberNumber) : O.none;

const isActivePurchaser = (
  purchasingArea: PurchasingArea,
  memberNumber: number
) =>
  purchasingArea.purchasers.some(
    purchaser =>
      purchaser.isOwnerOfAnArea &&
      allMemberNumbers(purchaser).includes(memberNumber)
  );

const ownsAnAreaIn = (
  rm: SharedReadModel,
  purchasingArea: PurchasingArea,
  memberNumber: number
) =>
  pipe(
    rm.members.getByMemberNumber(memberNumber),
    O.exists(member =>
      member.ownerOf.some(owned =>
        purchasingArea.areas.some(area => area.id === owned.id)
      )
    )
  );

export const canRequestFor = (
  rm: SharedReadModel,
  actor: Actor,
  purchasingArea: PurchasingArea
) =>
  isAdminOrSuperUser({actor, rm}) ||
  pipe(
    memberNumberOf(actor),
    O.exists(
      memberNumber =>
        ownsAnAreaIn(rm, purchasingArea, memberNumber) ||
        isActivePurchaser(purchasingArea, memberNumber)
    )
  );

// Who can buy for it directly; see src/purchasing/buy-directly.ts. The admin
// API counts as a super user.
export const buyerRoleFor = (
  rm: SharedReadModel,
  actor: Actor,
  purchasingArea: PurchasingArea
): BuyerRole =>
  isAdminOrSuperUser({actor, rm})
    ? 'super-user'
    : pipe(
          memberNumberOf(actor),
          O.exists(memberNumber => isActivePurchaser(purchasingArea, memberNumber))
        )
      ? 'purchaser'
      : 'neither';

// Who can approve or decline a request awaiting approval.
export const canDecide = (
  rm: SharedReadModel,
  actor: Actor,
  request: PurchaseRequest
) =>
  isAdminOrSuperUser({actor, rm}) ||
  (request.approval === 'none' &&
    pipe(
      O.Do,
      O.apS('memberNumber', memberNumberOf(actor)),
      O.apS(
        'purchasingArea',
        rm.purchasing.get(request.purchasingAreaId, new Date())
      ),
      O.exists(({memberNumber, purchasingArea}) =>
        isActivePurchaser(purchasingArea, memberNumber)
      )
    ));
