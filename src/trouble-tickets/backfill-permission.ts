import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {Dependencies} from '../dependencies';
import {constructEvent} from '../types';
import {defaultTicketPermission} from './default-permission';

type BackfillDependencies = Pick<
  Dependencies,
  'conf' | 'getAllEvents' | 'sharedReadModel' | 'commitEvent' | 'logger'
>;

// Preserve any visibility already chosen by an editor.
export const backfillTicketPermission =
  (deps: BackfillDependencies) => async (options: {dryRun: boolean}) => {
    const events = await deps.getAllEvents()();
    if (E.isLeft(events)) {
      throw new Error(`Cannot read events: ${events.left.message}`);
    }
    const legacyIds = new Set(
      events.right.flatMap(event =>
        event.deletedAt === null &&
        event.type === 'TroubleTicketCreated' &&
        event.permission === undefined
          ? [event.id]
          : []
      )
    );
    await deps.sharedReadModel.asyncRefresh()();
    const summary = {
      candidates: 0,
      backfilled: 0,
      skipped: 0,
      failed: 0,
      groups: {'area-owner': 0, manager: 0},
    };
    for (const id of legacyIds) {
      // Read the ticket and its audit history together immediately before
      // choosing. Optimistic concurrency rejects any intervening write.
      await deps.sharedReadModel.asyncRefresh()();
      const lastSeen = deps.sharedReadModel.getCurrentEventIndex();
      const ticket = deps.sharedReadModel.troubleTickets.getById(id);
      const alreadySet = deps.sharedReadModel.troubleTickets
        .getChangeLog([id])
        .some(change => change.eventType === 'TroubleTicketPermissionSet');
      if (O.isNone(ticket) || alreadySet) {
        summary.skipped++;
        continue;
      }
      const permission = defaultTicketPermission(
        deps.sharedReadModel,
        deps.conf.MANAGEMENT_TEAM_AREA_ID,
        // Use today's effective area, including any reassignment. Do not
        // re-resolve the original free-text equipment if it was cleared.
        {equipmentId: ticket.value.equipmentId, areaId: ticket.value.areaId}
      );
      summary.candidates++;
      if (permission === 'manager') {
        summary.groups.manager++;
      } else {
        summary.groups['area-owner']++;
      }
      if (options.dryRun) {
        continue;
      }
      const result = await deps.commitEvent(lastSeen)(
        constructEvent('TroubleTicketPermissionSet')({
          ticketId: id,
          permission,
          actor: {tag: 'token', token: 'admin'},
        })
      )();
      if (E.isLeft(result)) {
        summary.failed++;
        deps.logger.warn(
          {ticketId: id},
          'Permission backfill failed; rerun to retry'
        );
      } else {
        summary.backfilled++;
      }
    }
    deps.logger.info(
      {...summary, dryRun: options.dryRun},
      'Permission backfill finished'
    );
    return summary;
  };
