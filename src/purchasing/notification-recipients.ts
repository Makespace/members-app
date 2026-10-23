import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {UUID} from 'io-ts-types';
import {EmailAddress} from '../types/email-address';
import {SharedReadModel} from '../read-models/shared-state';
import {PurchaseRequest} from '../read-models/shared-state/return-types';
import {canDecide} from './permissions';

// Who hears about a purchase request, and why. Agreed rules:
//
// - Needing purchaser approval: the purchasing area's active purchasers
//   (super users if it has none).
// - Needing director approval: the Management Team and the Directors (the
//   owners of those areas; super users if neither is set up), and the owners
//   of the requesting area.
// - Could negatively impact other areas: as above, plus the owners of each
//   affected area (super users for an area with no owners).
// - Approved or declined: everyone who heard about it, and whoever sent it.
// - A super user going ahead without a proposal, or recording spending
//   approved outside the budget: the Directors.
//
// Whoever sent the request is never told about sending it, and whoever
// decided it is never told about deciding it.

export type NotificationReason =
  | 'purchaser'
  | 'management-team'
  | 'director'
  | 'requesting-area-owner'
  | 'affected-area-owner'
  | 'super-user'
  // For an outcome: told about the request when it was sent, or sent it.
  | 'heard-about-it'
  | 'requester';

export type Recipient = {
  memberNumber: number;
  email: EmailAddress;
  // Whether they can approve or decline it: a to-do rather than for
  // information.
  canDecide: boolean;
  reasons: ReadonlyArray<NotificationReason>;
  // The areas it could negatively impact that they own, by name.
  affectedAreas: ReadonlyArray<string>;
};

type NotificationAreas = {
  MANAGEMENT_TEAM_AREA_ID: string;
  DIRECTORS_AREA_ID: string;
};

type Person = {memberNumber: number; primaryEmailAddress: EmailAddress};

const ownersOf = (rm: SharedReadModel, areaId: string): ReadonlyArray<Person> =>
  areaId === ''
    ? []
    : pipe(
        rm.area.get(areaId as UUID),
        O.match(
          () => [],
          area => area.owners
        )
      );

const superUsers = (rm: SharedReadModel): ReadonlyArray<Person> =>
  rm.members.getAll().filter(member => member.isSuperUser);

// Collects people, merging the reasons of anyone added more than once.
const collect = (rm: SharedReadModel, request: PurchaseRequest) => {
  const byMember = new Map<number, Recipient>();
  const add = (
    people: ReadonlyArray<Person>,
    reason: NotificationReason,
    affectedArea?: string
  ) =>
    people.forEach(person => {
      const existing = byMember.get(person.memberNumber);
      if (existing) {
        byMember.set(person.memberNumber, {
          ...existing,
          reasons: existing.reasons.includes(reason)
            ? existing.reasons
            : [...existing.reasons, reason],
          affectedAreas:
            affectedArea === undefined
              ? existing.affectedAreas
              : [...existing.affectedAreas, affectedArea],
        });
        return;
      }
      byMember.set(person.memberNumber, {
        memberNumber: person.memberNumber,
        email: person.primaryEmailAddress,
        canDecide: canDecide(
          rm,
          {
            tag: 'user',
            user: {
              memberNumber: person.memberNumber,
              emailAddress: person.primaryEmailAddress,
            },
          },
          request
        ),
        reasons: [reason],
        affectedAreas: affectedArea === undefined ? [] : [affectedArea],
      });
    });
  const without = (...memberNumbers: ReadonlyArray<number>) =>
    [...byMember.values()].filter(
      recipient => !memberNumbers.includes(recipient.memberNumber)
    );
  return {add, without};
};

// An empty group falls back to the super users, so somebody hears.
const orSuperUsers = (
  rm: SharedReadModel,
  people: ReadonlyArray<Person>
): {people: ReadonlyArray<Person>; fellBack: boolean} =>
  people.length > 0
    ? {people, fellBack: false}
    : {people: superUsers(rm), fellBack: true};

const directorsOf = (rm: SharedReadModel, areas: NotificationAreas) =>
  orSuperUsers(rm, ownersOf(rm, areas.DIRECTORS_AREA_ID));

export const recipientsForNewRequest = (
  rm: SharedReadModel,
  areas: NotificationAreas,
  request: PurchaseRequest
): ReadonlyArray<Recipient> => {
  const {add, without} = collect(rm, request);
  const purchasingArea = rm.purchasing.get(request.purchasingAreaId, new Date());
  if (request.approval === 'none') {
    const purchasers = pipe(
      purchasingArea,
      O.match(
        () => [],
        area => area.purchasers.filter(purchaser => purchaser.isOwnerOfAnArea)
      )
    );
    const {people, fellBack} = orSuperUsers(rm, purchasers);
    add(people, fellBack ? 'super-user' : 'purchaser');
    return without(request.submittedByMemberNumber);
  }
  const management = ownersOf(rm, areas.MANAGEMENT_TEAM_AREA_ID);
  const directors = ownersOf(rm, areas.DIRECTORS_AREA_ID);
  add(management, 'management-team');
  add(directors, 'director');
  if (management.length === 0 && directors.length === 0) {
    add(superUsers(rm), 'super-user');
  }
  pipe(
    purchasingArea,
    O.map(area =>
      area.areas.forEach(owned =>
        add(ownersOf(rm, owned.id), 'requesting-area-owner')
      )
    )
  );
  request.affectedAreaIds.forEach(areaId => {
    const {people, fellBack} = orSuperUsers(rm, ownersOf(rm, areaId));
    if (fellBack) {
      add(people, 'super-user');
      return;
    }
    add(
      people,
      'affected-area-owner',
      pipe(
        rm.area.get(areaId),
        O.match(
          () => 'an area',
          area => area.name
        )
      )
    );
  });
  return without(request.submittedByMemberNumber);
};

// A purchase a super user recorded without the proposal it would otherwise
// need, or as approved outside the budget.
export const skippedProposal = (request: PurchaseRequest) =>
  request.status === 'bought-directly' &&
  (request.outcome === 'outside-budget' || request.approval === 'proposal');

export const recipientsForSkippedProposal = (
  rm: SharedReadModel,
  areas: NotificationAreas,
  request: PurchaseRequest
): ReadonlyArray<Recipient> => {
  const {add, without} = collect(rm, request);
  const {people, fellBack} = directorsOf(rm, areas);
  add(people, fellBack ? 'super-user' : 'director');
  return without(request.submittedByMemberNumber);
};

export const recipientsForOutcome = (
  rm: SharedReadModel,
  request: PurchaseRequest
): ReadonlyArray<Recipient> => {
  const {add, without} = collect(rm, request);
  const members = (memberNumbers: ReadonlyArray<number>) =>
    memberNumbers.flatMap(memberNumber =>
      pipe(
        rm.members.getByMemberNumber(memberNumber),
        O.match(
          () => [],
          member => [member]
        )
      )
    );
  add(members([request.submittedByMemberNumber]), 'requester');
  add(members(rm.purchasing.notifiedAbout(request.id)), 'heard-about-it');
  // Nothing is left to decide.
  return pipe(
    request.decidedByMemberNumber,
    O.match(
      () => without(),
      decider => without(decider)
    )
  ).map(recipient => ({...recipient, canDecide: false}));
};
