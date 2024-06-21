import {area} from './area';
import {equipment} from './equipment';
import {trainers} from './trainers';
import {members} from './members';
import {memberNumbers} from './member-numbers';
import {superUser} from './super-user';
import {ownerAgreementInvite} from './owner-agreement-invite';

export const commands = {
  area,
  equipment,
  trainers,
  superUser,
  memberNumbers,
  members,
};

export const sendEmailCommands = {
  ownerAgreementInvite,
};

export {Command} from './command';
export {SendEmail} from './send-email';
