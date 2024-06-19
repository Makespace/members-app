import {Dependencies} from './dependencies';
import {Config} from './configuration';
import {commands} from './commands';
import * as queries from './queries';
import {Route, get} from './types/route';
import {authRoutes} from './authentication';
import {queryToHandler, commandToHandlers, ping} from './http';
import {apiToHandlers} from './http/api-to-handlers';

export const initRoutes = (
  deps: Dependencies,
  conf: Config
): ReadonlyArray<Route> => {
  const query = queryToHandler(deps);
  const command = commandToHandlers(deps, conf);
  const api = apiToHandlers(deps, conf);
  return [
    query('/', queries.landing),
    query('/event-log', queries.log),
    query('/areas', queries.areas),
    ...command('areas', 'create', commands.area.create),
    ...command('areas', 'add-owner', commands.area.addOwner),
    query('/areas/:area', queries.area),
    query('/equipment', queries.allEquipment),
    ...command('equipment', 'add', commands.equipment.add),
    ...command('equipment', 'add-trainer', commands.trainers.add),
    ...command(
      'equipment',
      'add-training-sheet',
      commands.equipment.trainingSheet
    ),
    ...api(
      'equipment',
      'add-training-quiz-result',
      commands.equipment.trainingSheetQuizResult
    ),
    query('/equipment/:equipment', queries.equipment),
    query('/super-users', queries.superUsers),
    ...command('super-users', 'declare', commands.superUser.declare),
    ...command('super-users', 'revoke', commands.superUser.revoke),
    query('/member/:member', queries.member),
    query('/members', queries.members),
    ...command('members', 'create', commands.memberNumbers.linkNumberToEmail),
    ...command('members', 'edit-name', commands.members.editName),
    ...command('members', 'edit-pronouns', commands.members.editPronouns),
    ...command(
      'members',
      'sign-owner-agreement',
      commands.members.signOwnerAgreement
    ),
    get('/ping', ping),
    ...authRoutes,
  ];
};
