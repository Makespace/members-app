import {Dependencies} from './dependencies';
import {Config} from './configuration';
import {commands, sendEmailCommands} from './commands';
import {troubleTicketCommands} from './commands/trouble-tickets';
import * as queries from './queries';
import {Route, get} from './types/route';
import {authRoutes} from './authentication';
import {queryToHandler, commandToHandlers, ping} from './http';
import {apiToHandlers} from './http/api-to-handlers';
import {emailHandler} from './http/email-handler';

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
    query('/raise-issue', queries.raiseIssue),
    query('/humans', queries.humans),
    query('/event-log', queries.log),
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
    query('/equipment', queries.allEquipment),
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
    // Trouble ticket write side. Interactive forms follow; for now these are API-only
    // (bearer token) so admins/seeding can create tickets and drive status changes.
    ...api('trouble-tickets', 'create', troubleTicketCommands.create),
    ...command('trouble-tickets', 'assign', troubleTicketCommands.assign),
    ...command('trouble-tickets', 'resolve', troubleTicketCommands.resolve),
    ...command('trouble-tickets', 'park', troubleTicketCommands.park),
    ...command('trouble-tickets', 'needs-help', troubleTicketCommands.needsHelp),
    ...api('trouble-tickets', 'set-equipment', troubleTicketCommands.setEquipment),
    ...api('trouble-tickets', 'edit-title', troubleTicketCommands.editTitle),
    query('/google', queries.logGoogleJson),
    ...authRoutes(deps, conf),
  ];
};
