import * as O from 'fp-ts/Option';
import * as E from 'fp-ts/Either';
import {pipe} from 'fp-ts/function';
import {NonEmptyString, UUID} from 'io-ts-types';
import {Dependencies} from './dependencies';
import {Config} from './configuration';
import {commands, sendEmailCommands} from './commands';
import * as queries from './queries';
import {Route, get, post} from './types/route';
import {authRoutes} from './authentication';
import {queryToHandler, commandToHandlers, ping} from './http';
import {formGet} from './http/form-get';
import {bulkAddForm} from './commands/equipment/bulk-add-form';
import {apiToHandlers} from './http/api-to-handlers';
import {emailHandler} from './http/email-handler';
import expressAsyncHandler from 'express-async-handler';
import {backfillTrainingQuizTimeline} from './training-quiz/backfill-timeline';
import {
  backfillTroubleTicketTimeline,
  planTroubleTicketBackfill,
} from './trouble-tickets/backfill-timeline';
import {constantTimeEqual} from './http/constant-time-equal';
import {bulkQuietResolve} from './trouble-tickets/bulk-quiet-resolve';
import * as t from 'io-ts';
import {v4} from 'uuid';
import {StatusCodes} from 'http-status-codes';
import {getUserFromSession} from './authentication';
import {logInPath} from './authentication/login/routes';
import {applyCommand} from './commands/apply-command';
import {oopsPage} from './templates';
import {safe, sanitizeString} from './types/html';
import {Actor} from './types/actor';

export const initRoutes = (
  deps: Dependencies,
  conf: Config
): ReadonlyArray<Route> => {
  const query = queryToHandler(deps);
  const command = commandToHandlers(deps, conf);
  const api = apiToHandlers(deps, conf);
  const email = emailHandler(conf, deps);
  return [
    query('/', queries.me),
    query('/admin', queries.admin),
    query('/about', queries.about),
    // The old name for /about; deep links (#bad-records etc.) survive.
    get('/raise-issue', (_req, res) => res.redirect('/about')),
    query('/humans', queries.humans),
    query('/roadmap', queries.roadmap),
    query('/event-log', queries.log),
    query('/event-log-order', queries.eventLogOrder),
    query('/event-log-order/:index', queries.eventLogOrder),
    query('/training-event-log', queries.trainingEventLog),
    query('/event-log/failed', queries.failedEventLog),
    query('/event-log/deleted', queries.deletedEvents),
    ...command('event-log', 'delete', commands.eventLog.delete),
    ...command('event-log', 'undelete', commands.eventLog.undelete),
    query('/event-log.csv', queries.logcsv),
    query('/training-status.csv', queries.trainingStatusCsv),
    query('/domain-events', queries.domainEvents),
    query('/unlinked-recurly', queries.unlinkedRecurly),
    query('/areas', queries.areas),
    query('/community', queries.community),
    query('/equipment-catalogue', queries.equipmentCatalogue),
    ...command('areas', 'create', commands.area.create),
    ...command('areas', 'add-owner', commands.area.addOwner),
    ...command('areas', 'remove-owner', commands.area.removeOwner),
    ...command('areas', 'remove', commands.area.remove),
    ...command('areas', 'set-mailing-List', commands.area.setMailingList),
    ...command('areas', 'add-name-alias', commands.area.addNameAlias),
    ...api('areas', 'remove-name-alias', commands.area.removeNameAlias),
    ...command('equipment', 'add', commands.equipment.add),
    ...api('equipment', 'set-category', commands.equipment.setCategory),
    ...command('equipment', 'set-machines', commands.equipment.setMachines),
    // Bulk-add: one EquipmentAdded per pasted line. A bespoke POST because
    // the command pipeline commits exactly one event per request; the GET is
    // the standard form renderer.
    get(
      '/equipment/bulk-add',
      expressAsyncHandler(formGet(deps, bulkAddForm))
    ),
    post(
      '/equipment/bulk-add',
      expressAsyncHandler(async (req, res) => {
        const user = getUserFromSession(deps)(req.session);
        if (O.isNone(user)) {
          res.redirect(logInPath);
          return;
        }
        const actor: Actor = {tag: 'user', user: user.value};
        const body = t
          .strict({
            areaId: UUID,
            // Red is deliberately not bulk-addable: it needs training set up
            // per machine, so it goes through the single add form.
            category: t.keyof({orange: null, green: null}),
            names: t.string,
          })
          .decode(req.body);
        if (E.isLeft(body)) {
          res.status(StatusCodes.BAD_REQUEST).send(
            oopsPage(safe('That bulk-add submission was not valid.'))
          );
          return;
        }
        const {areaId, category, names} = body.right;
        const toAdd = [
          ...new Set(
            names
              .split('\n')
              .map(line => line.trim())
              .filter(line => line !== '')
          ),
        ].map(name => ({
          id: v4() as UUID,
          name: name as NonEmptyString,
          areaId,
          category,
        }));
        if (toAdd.length === 0) {
          res.redirect(`/areas#area-${areaId}`);
          return;
        }
        // Authorization does not vary by name, so one check covers the batch.
        if (
          !commands.equipment.add.isAuthorized({
            actor,
            rm: deps.sharedReadModel,
            input: toAdd[0],
          })
        ) {
          res
            .status(StatusCodes.FORBIDDEN)
            .send(
              oopsPage(
                safe(
                  'Only owners of this area (or admins) can add equipment to it.'
                )
              )
            );
          return;
        }
        const failed: string[] = [];
        for (const input of toAdd) {
          const result = await applyCommand(deps, commands.equipment.add)(
            input,
            actor
          )();
          if (E.isLeft(result)) {
            failed.push(input.name);
            deps.logger.warn(
              result.left,
              'Bulk-add failed for equipment %s',
              input.name
            );
          }
        }
        if (failed.length > 0) {
          res
            .status(StatusCodes.INTERNAL_SERVER_ERROR)
            .send(
              oopsPage(
                sanitizeString(
                  `Added ${toAdd.length - failed.length} of ${toAdd.length}. These failed: ${failed.join(', ')}`
                )
              )
            );
          return;
        }
        res.redirect(`/areas#area-${areaId}`);
      })
    ),
    ...command('equipment', 'add-trainer', commands.trainers.add),
    ...command('equipment', 'remove-trainer', commands.trainers.remove),
    ...command(
      'equipment',
      'add-training-sheet',
      commands.equipment.trainingSheet
    ),
    ...command(
      'equipment',
      'remove-training-sheet',
      commands.equipment.removeTrainingSheet
    ),
    ...command(
      'equipment',
      'mark-obsolete',
      commands.equipment.markObsolete
    ),
    ...command(
      'equipment',
      'add-name-alias',
      commands.equipment.addNameAlias
    ),
    ...api(
      'equipment',
      'remove-name-alias',
      commands.equipment.removeNameAlias
    ),
    ...command(
      'equipment',
      'mark-member-trained',
      commands.trainers.markTrained
    ),
    ...command(
      'equipment',
      'revoke-member-trained',
      commands.trainers.revokeTrained
    ),
    ...command(
      'equipment',
      'mark-member-trained-by',
      commands.trainers.markMemberTrainedBy
    ),
    post(
      '/api/training-quiz/backfill-timeline',
      expressAsyncHandler(async (req, res) => {
        if (
          !constantTimeEqual(
            req.headers.authorization ?? '',
            `Bearer ${conf.ADMIN_API_BEARER_TOKEN}`
          )
        ) {
          res.status(401).send({message: 'Bad Bearer Token'});
          return;
        }
        // Optional: scope the catch-up to a single piece of equipment (a canary
        // run). Absent => import every mapped sheet.
        const rawEquipmentId = req.query.equipmentId;
        if (rawEquipmentId !== undefined && typeof rawEquipmentId !== 'string') {
          res.status(400).send({message: 'equipmentId must be a single UUID'});
          return;
        }
        const equipmentId = pipe(
          O.fromNullable(rawEquipmentId),
          O.map(UUID.decode)
        );
        if (O.isSome(equipmentId) && E.isLeft(equipmentId.value)) {
          res.status(400).send({message: 'equipmentId is not a valid UUID'});
          return;
        }
        const summary = await backfillTrainingQuizTimeline(deps)(
          pipe(equipmentId, O.chain(O.fromEither), O.toUndefined)
        );
        res.status(200).send(summary);
      })
    ),
    post(
      '/api/trouble-tickets/backfill-timeline',
      expressAsyncHandler(async (req, res) => {
        if (
          !constantTimeEqual(
            req.headers.authorization ?? '',
            `Bearer ${conf.ADMIN_API_BEARER_TOKEN}`
          )
        ) {
          res.status(401).send({message: 'Bad Bearer Token'});
          return;
        }
        // Optional: scope the catch-up to submissions strictly before a date
        // (a canary run). Absent => import every cached row.
        const rawBefore = req.query.before;
        if (rawBefore !== undefined && typeof rawBefore !== 'string') {
          res.status(400).send({message: 'before must be a single ISO date'});
          return;
        }
        const before =
          rawBefore === undefined ? undefined : new Date(rawBefore);
        if (before !== undefined && isNaN(before.getTime())) {
          res.status(400).send({message: 'before is not a valid ISO date'});
          return;
        }
        // ?dryRun=true reports what would be woven in without writing. Any
        // other value is rejected rather than silently running the real thing.
        if (req.query.dryRun !== undefined && req.query.dryRun !== 'true') {
          res.status(400).send({message: "dryRun must be exactly 'true'"});
          return;
        }
        if (req.query.dryRun === 'true') {
          const {inserts: _inserts, ...plan} =
            await planTroubleTicketBackfill(deps)(before);
          res.status(200).send(plan);
          return;
        }
        const summary = await backfillTroubleTicketTimeline(deps)(before);
        res.status(200).send(summary);
      })
    ),
    // Bulk backlog closure: quietly resolve every open ticket submitted
    // before a date. Quiet resolves are skipped by the notification sweep, so
    // nobody is emailed. Already-resolved tickets are untouched, so a repeat
    // run is a no-op. See docs/trouble-ticket-migration.md.
    post(
      '/api/trouble-tickets/bulk-quiet-resolve',
      expressAsyncHandler(async (req, res) => {
        if (
          !constantTimeEqual(
            req.headers.authorization ?? '',
            `Bearer ${conf.ADMIN_API_BEARER_TOKEN}`
          )
        ) {
          res.status(401).send({message: 'Bad Bearer Token'});
          return;
        }
        const rawBefore = req.query.before;
        if (typeof rawBefore !== 'string') {
          res
            .status(400)
            .send({message: 'before is required, as a single ISO date'});
          return;
        }
        const before = new Date(rawBefore);
        if (isNaN(before.getTime())) {
          res.status(400).send({message: 'before is not a valid ISO date'});
          return;
        }
        // ?dryRun=true reports what would be closed without writing. Any other
        // value is rejected rather than silently running the real thing.
        if (req.query.dryRun !== undefined && req.query.dryRun !== 'true') {
          res.status(400).send({message: "dryRun must be exactly 'true'"});
          return;
        }
        const summary = await bulkQuietResolve(deps)(before, {
          dryRun: req.query.dryRun === 'true',
        });
        res.status(200).send(summary);
      })
    ),
    get('/equipment', (_req, res) => res.redirect('/areas')),
    query('/equipment/:equipment/training', queries.equipmentTraining),
    query('/equipment/:equipment', queries.equipment),
    query('/super-users', queries.superUsers),
    ...command('super-users', 'declare', commands.superUser.declare),
    ...command('super-users', 'revoke', commands.superUser.revoke),
    query('/me', queries.me),
    query('/member/:member', queries.member),
    query('/members', queries.members),
    ...command('members', 'create', commands.memberNumbers.linkNumberToEmail),
    ...command('members', 'edit-name', commands.members.editName),
    ...command('members', 'add-email', commands.members.addEmail),
    ...command(
      'members',
      'edit-form-of-address',
      commands.members.editFormOfAddress
    ),
    ...command(
      'members',
      'change-primary-email',
      commands.members.changePrimaryEmail
    ),
    ...command(
      'members',
      'sign-owner-agreement',
      commands.members.signOwnerAgreement
    ),
    ...command(
      'members',
      'send-email-verification',
      commands.members.sendEmailVerification
    ),
    ...command(
      'members',
      'rejoined-with-new',
      commands.memberNumbers.markMemberRejoinedWithNewNumber
    ),
    ...command(
      'members',
      'rejoined-with-existing',
      commands.memberNumbers.markMemberRejoinedWithExistingNumber
    ),
    email('owner-agreement-invite', sendEmailCommands.ownerAgreementInvite),
    get('/ping', ping),
    query('/db', queries.db),
    query('/debug/dump-shared-db/json', queries.dumpSharedDbAsJson),
    query('/debug/dump-shared-db/buffer', queries.dumpSharedDbAsBuffer),

    // Temporary location for POC - may move under individual equipments eventually.
    query('/equipment-signs', queries.equipmentSigns),
    query('/trouble-tickets', queries.troubleTicketsHome),
    query('/trouble-tickets/board', queries.troubleTickets),
    // Site notification banners: admin management + member dismissal.
    query('/notifications', queries.notifications),
    // Imported management mailbox (read-only in this iteration).
    query('/mailbox', queries.mailbox),
    query('/mailbox/:id', queries.mailbox),
    ...command('notifications', 'create', commands.notifications.create),
    ...command('notifications', 'dismiss', commands.notifications.dismiss),
    ...command('notifications', 'revoke', commands.notifications.revoke),
    // Trouble ticket write side. create/set-equipment/edit-title are API-only
    // (bearer token); the status actions have confirmation pages.
    ...api('trouble-tickets', 'create', commands.troubleTickets.create),
    ...command('trouble-tickets', 'raise', commands.troubleTickets.raise),
    ...command('trouble-tickets', 'assign', commands.troubleTickets.assign),
    ...command('trouble-tickets', 'resolve', commands.troubleTickets.resolve),
    ...command('trouble-tickets', 'park', commands.troubleTickets.park),
    ...command(
      'trouble-tickets',
      'needs-help',
      commands.troubleTickets.needsHelp
    ),
    ...api(
      'trouble-tickets',
      'set-equipment',
      commands.troubleTickets.setEquipment
    ),
    ...api('trouble-tickets', 'edit-title', commands.troubleTickets.editTitle),
    query('/google', queries.logGoogleJson),
    ...authRoutes(deps, conf),
  ];
};
