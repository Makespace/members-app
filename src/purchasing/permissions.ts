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
// - Nobody, super users included, can request or buy for a purchasing area
//   until it is active. Requests already made can still be decided.

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
  purchasingArea.active &&
  (isAdminOrSuperUser({actor, rm}) ||
    pipe(
      memberNumberOf(actor),
      O.exists(
        memberNumber =>
          ownsAnAreaIn(rm, purchasingArea, memberNumber) ||
          isActivePurchaser(purchasingArea, memberNumber)
      )
    ));

// Who can buy for it directly; see src/purchasing/buy-directly.ts. The admin
// API counts as a super user.
export const buyerRoleFor = (
  rm: SharedReadModel,
  actor: Actor,
  purchasingArea: PurchasingArea
): BuyerRole =>
  !purchasingArea.active
    ? 'neither'
    : isAdminOrSuperUser({actor, rm})
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

// Who can mark an approved request as bought: the same people who can
// approve it, so a purchaser can't record buying something that needed
// director approval - a manager or director buys that.
export const canMarkBought = canDecide;

// Whoever bought it: who marked it bought, or who bought it directly.
export const buyerOf = (request: PurchaseRequest): O.Option<number> => {
  switch (request.status) {
    case 'bought':
      return request.boughtByMemberNumber;
    case 'bought-directly':
      return O.some(request.submittedByMemberNumber);
    default:
      return O.none;
  }
};

// Bought, after approval or directly: its receipt or invoice can be sent on.
export const isBought = (request: PurchaseRequest) =>
  O.isSome(buyerOf(request));

// A bought purchase whose receipt or invoice still needs passing on to the
// accountant.
export const needsInvoiceSent = (request: PurchaseRequest) =>
  isBought(request) && O.isNone(request.invoiceSentAt);

// Who can upload its receipt or invoice, or mark it as sent: whoever bought
// it, the area's purchasers, and super users.
export const canMarkInvoiceSent = (
  rm: SharedReadModel,
  actor: Actor,
  request: PurchaseRequest
) =>
  O.isSome(buyerOf(request)) &&
  (isAdminOrSuperUser({actor, rm}) ||
    pipe(
      memberNumberOf(actor),
      O.exists(
        memberNumber =>
          pipe(
            buyerOf(request),
            O.exists(buyer => buyer === memberNumber)
          ) ||
          pipe(
            rm.purchasing.get(request.purchasingAreaId, new Date()),
            O.exists(area => isActivePurchaser(area, memberNumber))
          )
      )
    ));

// Who can see its uploaded receipts and invoices: anyone who could upload
// them, whoever requested it, and the Management Team and Directors (who
// read management@, where they are emailed). Not every member: an invoice can carry someone's
// address or card details.
export const canViewReceipts = (
  rm: SharedReadModel,
  areas: {MANAGEMENT_TEAM_AREA_ID: string; DIRECTORS_AREA_ID: string},
  actor: Actor,
  request: PurchaseRequest
) =>
  canMarkInvoiceSent(rm, actor, request) ||
  pipe(
    memberNumberOf(actor),
    O.exists(
      memberNumber =>
        memberNumber === request.submittedByMemberNumber ||
        pipe(
          rm.members.getByMemberNumber(memberNumber),
          O.exists(member =>
            member.ownerOf.some(
              owned =>
                (areas.MANAGEMENT_TEAM_AREA_ID !== '' &&
                  owned.id === areas.MANAGEMENT_TEAM_AREA_ID) ||
                (areas.DIRECTORS_AREA_ID !== '' &&
                  owned.id === areas.DIRECTORS_AREA_ID)
            )
          )
        )
    )
  );
