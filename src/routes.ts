import {Dependencies} from './dependencies';
import {Config} from './configuration';
import {commands, sendEmailCommands} from './commands';
import * as queries from './queries';
import {Route, get} from './types/route';
import {authRoutes} from './authentication';
import {queryToHandler, commandToHandlers, ping} from './http';
import {emailHandler} from './http/email-handler';

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
    query('/event-log', queries.log),
    query('/event-log.csv', queries.logcsv),
    query('/training-status.csv', queries.trainingStatusCsv),
    query('/areas', queries.areas),
    ...command('areas', 'create', commands.area.create),
    ...command('areas', 'add-owner', commands.area.addOwner),
    ...command('areas', 'remove-owner', commands.area.removeOwner),
    ...command('areas', 'remove', commands.area.remove),
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
      'mark-member-trained',
      commands.trainers.markTrained
    ),
    ...command(
      'equipment',
      'revoke-member-trained',
      commands.trainers.revokeTrained
    ),
    query('/equipment/:equipment', queries.equipment),
    query('/super-users', queries.superUsers),
    ...command('super-users', 'declare', commands.superUser.declare),
    ...command('super-users', 'revoke', commands.superUser.revoke),
    query('/me', queries.me),
    query('/member/:member', queries.member),
    query('/members/failed-imports', queries.failedImports),
    query('/members', queries.members),
    ...command('members', 'create', commands.memberNumbers.linkNumberToEmail),
    ...command('members', 'edit-name', commands.members.editName),
    ...command('members', 'edit-pronouns', commands.members.editPronouns),
    ...command(
      'members',
      'sign-owner-agreement',
      commands.members.signOwnerAgreement
    ),
    email('owner-agreement-invite', sendEmailCommands.ownerAgreementInvite),
    get('/ping', ping),
    query('/debug/dump-shared-db', queries.dumpSharedDbAsJson),
    ...authRoutes(deps),
  ];
};
