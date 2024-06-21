import * as t from 'io-ts';
import * as E from 'fp-ts/Either';
import * as tt from 'io-ts-types';
import {SendEmail} from '../send-email';
import {isAdminOrSuperUser} from '../is-admin-or-super-user';
import {pipe} from 'fp-ts/lib/function';
import {readModels} from '../../read-models';
import {failureWithStatus} from '../../types/failureWithStatus';
import {StatusCodes} from 'http-status-codes';
import {Email, EmailAddress} from '../../types';
import {htmlEmailTemplate, textEmailTemplate} from './email-template';

const codec = t.strict({
  recipient: tt.NumberFromString,
});

type OwnerAgreementInvite = t.TypeOf<typeof codec>;

const constructEmail: SendEmail<OwnerAgreementInvite>['constructEmail'] = (
  conf,
  events,
  actor,
  input
) =>
  pipe(
    events,
    readModels.members.getDetails(input.recipient),
    E.fromOption(() =>
      failureWithStatus(
        'Recipient is not a known member',
        StatusCodes.BAD_REQUEST
      )()
    ),
    E.map(
      (member): Email => ({
        recipient: member.email as EmailAddress,
        text: textEmailTemplate(conf.PUBLIC_URL),
        subject: 'Sign the MS Owner Agreement',
        html: htmlEmailTemplate(conf.PUBLIC_URL),
      })
    )
  );

export const ownerAgreementInvite: SendEmail<OwnerAgreementInvite> = {
  isAuthorized: isAdminOrSuperUser,
  decode: codec.decode,
  constructEmail,
};
