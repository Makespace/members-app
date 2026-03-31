import {area} from './area';
import {events} from './events';
import {equipment} from './equipment';
import {trainers} from './trainers';
import {members} from './members';
import {memberNumbers} from './member-numbers';
import {superUser} from './super-user';
import {ownerAgreementInvite} from './owner-agreement-invite';

export const commands = {
  area,
  events,
  equipment,
  trainers,
  superUser,
  memberNumbers,
  members,
};

export const sendEmailCommands = {
  ownerAgreementInvite,
};

export type {Command} from './command';
export type {SendEmail} from './send-email';
