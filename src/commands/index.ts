import {area} from './area';
import {equipment} from './equipment';
import {trainers} from './trainers';
import {members} from './members';
import {memberNumbers} from './member-numbers';
import {superUser} from './super-user';
import {ownerAgreementInvite} from './owner-agreement-invite';
import {eventLog} from './event-log';
import {trainingQuiz} from './training-quiz';

export const commands = {
  area,
  equipment,
  trainers,
  superUser,
  memberNumbers,
  members,
  eventLog,
  trainingQuiz,
};

export const sendEmailCommands = {
  ownerAgreementInvite,
};

export type {Command} from './command';
export type {SendEmail} from './send-email';
