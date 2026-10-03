import {User, UserId} from '../../types';
import {Dependencies} from '../../dependencies';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {
  failureWithStatus,
  FailureWithStatus,
} from '../../types/failure-with-status';
import {
  AreaViewModel,
  EquipmentViewModel,
  OwnerViewModel,
  ViewModel,
} from './view-model';
import {ExternalStateDB} from '../../sync-worker/external-state-db';
import {
  getRecurlyFlagsForVerifiedEmails,
  recurlyReasons,
  RecurlyFlags,
  RecurlyReason,
} from '../../read-models/external-state/recurly-status';
import {StatusCodes} from 'http-status-codes';
import {
  trainingsByQuarter,
} from '../../read-models/shared-state/member/training-delivered';
import {DateTime} from 'luxon';
import {UUID} from 'io-ts-types';
import {AreaOwnerRow} from '../../read-models/shared-state/area/get';
import {MinimalEquipment} from '../../read-models/shared-state/return-types';

type OwnerFlags = O.Option<RecurlyFlags>;

// Owners enriched without super-user data: everyone is listed as a public
// owner, no reason chips and no chart-based active/inactive verdict.
const NO_RECURLY = {isActiveOwner: true, reasons: [] as ReadonlyArray<RecurlyReason>};

// Owner enrichment shared by the super-user path. Active-for-ownership is a
// rule local to this page: a past-due invoice counts as inactive, since
// cancelling payment is a common way members self-deactivate. The shared
// 'active'/'inactive' status calc is unchanged.
const evaluateOwner = (flags: OwnerFlags) => {
  const isActiveOwner =
    O.isSome(flags) &&
    flags.value.hasActiveSubscription &&
    !flags.value.hasPastDueInvoice;
  return {isActiveOwner, reasons: recurlyReasons(flags)};
};

export const constructViewModel =
  (sharedReadModel: Dependencies['sharedReadModel'], extDB: ExternalStateDB) =>
  (user: User): TE.TaskEither<FailureWithStatus, ViewModel> =>
  async () => {
    const member = sharedReadModel.members.getByMemberNumber(user.memberNumber);
    if (O.isNone(member)) {
      return E.left(
        failureWithStatus(
          'Cannot find sufficient information about you to determine if you can access this page',
          StatusCodes.UNAUTHORIZED
        )()
      );
    }

    const isSuperUser = member.value.isSuperUser;
    const isOwnerOfAnyArea = member.value.ownerOf.length > 0;
    const canSeeTrainings = isSuperUser || isOwnerOfAnyArea;

    const now = DateTime.now();

    // Minimal views for everything the page shows: one query per table
    // instead of expanding every machine's trainers, trainees and member
    // details (issue #414, deliverables C+D).
    const areas = sharedReadModel.area.getAllMinimal();
    const equipmentAll = sharedReadModel.equipment.getAllMinimal();
    const ownersAll = sharedReadModel.area.getAllOwnersBulk();

    const equipmentByArea = new Map<UUID, MinimalEquipment[]>();
    for (const equipment of equipmentAll) {
      const existing = equipmentByArea.get(equipment.areaId) ?? [];
      existing.push(equipment);
      equipmentByArea.set(equipment.areaId, existing);
    }

    const ownersByArea = new Map<UUID, AreaOwnerRow[]>();
    for (const owner of ownersAll) {
      const existing = ownersByArea.get(owner.areaId) ?? [];
      existing.push(owner);
      ownersByArea.set(owner.areaId, existing);
    }

    // Visible equipment drives the equipment list and the red-machine
    // charts; the full (retired-inclusive) id set drives owner-delivery
    // statistics, whose scope has always included retired machines.
    const visibleEquipmentByArea = new Map<UUID, MinimalEquipment[]>();
    const equipmentIdsByArea = new Map<UUID, UUID[]>();
    for (const area of areas) {
      const all = equipmentByArea.get(area.id) ?? [];
      visibleEquipmentByArea.set(
        area.id,
        // Hide obsolete equipment from members browsing for training.
        all.filter(equipment => O.isNone(equipment.removedAt))
      );
      equipmentIdsByArea.set(
        area.id,
        all.map(equipment => equipment.id)
      );
    }

    // Equipment charts exist only for visible red machines; one bulk query
    // covers all of them regardless of area count.
    const equipmentChartIds = areas.flatMap(area =>
      (visibleEquipmentByArea.get(area.id) ?? [])
        .filter(equipment => equipment.category === 'red')
        .map(equipment => equipment.id)
    );
    const equipmentTrainingDates = new Map<UUID, Date[]>();
    for (const row of sharedReadModel.equipment.trainingsForEquipmentBuckets(
      equipmentChartIds
    )) {
      const existing = equipmentTrainingDates.get(row.equipmentId) ?? [];
      existing.push(row.trainedAt);
      equipmentTrainingDates.set(row.equipmentId, existing);
    }

    // Owner delivery charts: only for viewers who can see the trainings
    // column, and only for areas whose visible equipment includes a red
    // machine (otherwise the column never renders). Scoped per area so an
    // owner of several areas keeps distinct statistics per area.
    const ownerTrainingScopes: {
      key: string;
      trainerMemberNumbers: ReadonlyArray<number>;
      equipmentIds: ReadonlyArray<UUID>;
    }[] = [];
    if (canSeeTrainings) {
      for (const area of areas) {
        const hasRedEquipment = (visibleEquipmentByArea.get(area.id) ?? []).some(
          equipment => equipment.category === 'red'
        );
        if (!hasRedEquipment) {
          continue;
        }
        for (const owner of ownersByArea.get(area.id) ?? []) {
          ownerTrainingScopes.push({
            key: `${area.id}|${owner.userId}`,
            // Past numbers count too: trainings delivered before a rejoin
            // stay filed under the old member number.
            trainerMemberNumbers: [owner.memberNumber, ...owner.pastMemberNumbers],
            equipmentIds: equipmentIdsByArea.get(area.id) ?? [],
          });
        }
      }
    }
    const ownerTrainingDates = new Map<string, Date[]>();
    if (ownerTrainingScopes.length > 0) {
      // Attribution per trainer number: an owner may hold several numbers
      // (current plus past) and several owners may share an area.
      const scopeKeysByTrainerNumber = new Map<number, Set<string>>();
      for (const scope of ownerTrainingScopes) {
        for (const number of scope.trainerMemberNumbers) {
          const keys = scopeKeysByTrainerNumber.get(number) ?? new Set<string>();
          keys.add(scope.key);
          scopeKeysByTrainerNumber.set(number, keys);
        }
      }
      const equipmentIdsByKey = new Map<string, Set<UUID>>(
        ownerTrainingScopes.map(scope => [
          scope.key,
          new Set(scope.equipmentIds),
        ])
      );
      for (const row of sharedReadModel.members.trainingsDeliveredByForAreas(
        ownerTrainingScopes.map(
          ({trainerMemberNumbers, equipmentIds}) => ({
            trainerMemberNumbers,
            equipmentIds,
          })
        )
      )) {
        const keys = scopeKeysByTrainerNumber.get(row.trainerMemberNumber);
        if (keys === undefined) {
          continue;
        }
        for (const key of keys) {
          if (equipmentIdsByKey.get(key)?.has(row.equipmentId)) {
            const existing = ownerTrainingDates.get(key) ?? [];
            existing.push(row.trainedAt);
            ownerTrainingDates.set(key, existing);
          }
        }
      }
    }

    // Only super-users see the inactive-owners section with its Recurly
    // reasons, so only they pay for subscription lookups. Owners are
    // enriched once per distinct user even when they own several areas.
    const ownerFlags = new Map<UserId, OwnerFlags>();
    if (isSuperUser) {
      const distinctOwnerUserIds: UserId[] = [
        ...new Set(ownersAll.map(owner => owner.userId)),
      ];
      const emailsByUser = sharedReadModel.members.getVerifiedEmailsByUserIds(
        distinctOwnerUserIds
      );
      const flagEntries = await Promise.all(
        distinctOwnerUserIds.map(async userId => {
          const emails = emailsByUser.get(userId) ?? [];
          const flags = await getRecurlyFlagsForVerifiedEmails(extDB)(emails);
          return [userId, flags] as const;
        })
      );
      for (const [userId, flags] of flagEntries) {
        ownerFlags.set(userId, flags);
      }
    }

    const buildOwners = (areaId: UUID): ReadonlyArray<OwnerViewModel> =>
      (ownersByArea.get(areaId) ?? []).map(owner => {
        const enriched = isSuperUser
          ? evaluateOwner(
              // An owner whose Recurly lookup somehow ran maps to 'no-data'.
              ownerFlags.get(owner.userId) ?? O.none
            )
          : NO_RECURLY;
        return {
          memberNumber: owner.memberNumber,
          name: owner.name,
          primaryEmailAddress: owner.primaryEmailAddress,
          agreementSigned: owner.agreementSigned,
          isActiveOwner: enriched.isActiveOwner,
          reasons: enriched.reasons,
          trainingsByQuarter:
            canSeeTrainings &&
            (visibleEquipmentByArea
              .get(areaId)
              ?.some(equipment => equipment.category === 'red') ?? false)
              ? trainingsByQuarter(
                  ownerTrainingDates.get(`${areaId}|${owner.userId}`) ?? [],
                  now
                )
              : [],
        };
      });

    return E.right({
      canManageAreas: isSuperUser,
      canSeeOwnerPrivateDetails: isSuperUser || isOwnerOfAnyArea,
      canSeeTrainings,
      areas: areas.map(
        (area): AreaViewModel => ({
          id: area.id,
          name: area.name,
          email: area.email,
          equipment: (visibleEquipmentByArea.get(area.id) ?? []).map(
            (equipment): EquipmentViewModel => ({
              id: equipment.id,
              name: equipment.name,
              category: equipment.category,
              // Only red machines draw a sparkline; the bucketing is skipped
              // entirely for the rest.
              trainingsByQuarter:
                equipment.category === 'red'
                  ? trainingsByQuarter(
                      equipmentTrainingDates.get(equipment.id) ?? [],
                      now
                    )
                  : [],
            })
          ),
          owners: buildOwners(area.id),
        })
      ),
    });
  };
