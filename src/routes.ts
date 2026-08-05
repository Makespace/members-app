import * as O from 'fp-ts/Option';
import * as E from 'fp-ts/Either';
import {pipe} from 'fp-ts/function';
import {UUID} from 'io-ts-types';
import {Dependencies} from './dependencies';
import {Config} from './configuration';
import {commands, sendEmailCommands} from './commands';
import * as queries from './queries';
import {Route, get, post} from './types/route';
import {authRoutes} from './authentication';
import {queryToHandler, commandToHandlers, ping} from './http';
import {emailHandler} from './http/email-handler';
import expressAsyncHandler from 'express-async-handler';
import {backfillTrainingQuizTimeline} from './training-quiz/backfill-timeline';
import {constantTimeEqual} from './http/constant-time-equal';

export const initRoutes = (
  deps: Dependencies,
  conf: Config
): ReadonlyArray<Route> => {
  const query = queryToHandler(deps);
  const command = commandToHandlers(deps, conf);
  const email = emailHandler(conf, deps);
  return [
    query('/', queries.me),
    query('/admin', queries.admin),
    query('/raise-issue', queries.raiseIssue),
    query('/humans', queries.humans),
    query('/event-log', queries.log),
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
    ...command('areas', 'create', commands.area.create),
    ...command('areas', 'add-owner', commands.area.addOwner),
    ...command('areas', 'remove-owner', commands.area.removeOwner),
    ...command('areas', 'remove', commands.area.remove),
    ...command('areas', 'set-mailing-List', commands.area.setMailingList),
    ...command('equipment', 'add', commands.equipment.add),
    ...command('equipment', 'add-trainer', commands.trainers.add),
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
    get('/equipment', (_req, res) => res.redirect('/areas')),
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
    query('/trouble-tickets', queries.troubleTickets),
    query('/google', queries.logGoogleJson),
    ...authRoutes(deps, conf),
  ];
};
