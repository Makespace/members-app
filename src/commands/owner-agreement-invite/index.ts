import * as t from 'io-ts';
import * as E from 'fp-ts/Either';
import * as tt from 'io-ts-types';
import {SendEmail} from '../send-email';
import {isAdminOrSuperUser} from '../is-admin-or-super-user';
import {pipe} from 'fp-ts/lib/function';
import {failureWithStatus} from '../../types/failure-with-status';
import {StatusCodes} from 'http-status-codes';
import {Email} from '../../types';
import {htmlEmailTemplate, textEmailTemplate} from './email-template';

const codec = t.strict({
  recipient: tt.NumberFromString,
});

type OwnerAgreementInvite = t.TypeOf<typeof codec>;

const constructEmail: SendEmail<OwnerAgreementInvite>['constructEmail'] = (
  conf,
  deps,
  actor,
  input
) =>
  pipe(
    input.recipient,
    deps.sharedReadModel.members.get,
    E.fromOption(() =>
      failureWithStatus(
        'Recipient is not a known member',
        StatusCodes.BAD_REQUEST
      )()
    ),
    E.map(
      (member): Email => ({
        recipient: member.emailAddress,
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
