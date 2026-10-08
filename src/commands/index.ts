import {area} from './area';
import {equipment} from './equipment';
import {trainers} from './trainers';
import {members} from './members';
import {memberNumbers} from './member-numbers';
import {superUser} from './super-user';
import {ownerAgreementInvite} from './owner-agreement-invite';
import {eventLog} from './event-log';
import {trainingQuiz} from './training-quiz';
import {troubleTickets} from './trouble-tickets';
import {notifications} from './notifications';
import {mailbox} from './mailbox';

import {notificationPreferences} from './notification-preferences';

// Annotated by module rather than inferred: with every command and form
// spelled out, the inferred type grew past what tsc will serialise for the
// declaration emit that `composite` asks for (TS7056).
type Commands = {
  notificationPreferences: typeof notificationPreferences;
  area: typeof area;
  equipment: typeof equipment;
  trainers: typeof trainers;
  superUser: typeof superUser;
  memberNumbers: typeof memberNumbers;
  members: typeof members;
  eventLog: typeof eventLog;
  trainingQuiz: typeof trainingQuiz;
  troubleTickets: typeof troubleTickets;
  notifications: typeof notifications;
  mailbox: typeof mailbox;
};

export const commands: Commands = {
  notificationPreferences,
  area,
  equipment,
  trainers,
  superUser,
  memberNumbers,
  members,
  eventLog,
  trainingQuiz,
  troubleTickets,
  notifications,
  mailbox,
};

export const sendEmailCommands = {
  ownerAgreementInvite,
};

export type {Command} from './command';
export type {SendEmail} from './send-email';
