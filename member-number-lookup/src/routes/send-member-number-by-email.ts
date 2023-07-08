import {Request, Response} from 'express';
import * as E from 'fp-ts/Either';
import {pipe} from 'fp-ts/lib/function';
import {oopsPage, checkYourMailPage} from '../shared-pages';
import {parseEmailAddressFromBody} from '../authentication/parse-email-address-from-body';
import {publish} from 'pubsub-js';

export const sendMemberNumberByEmail = (req: Request, res: Response) => {
  pipe(
    req.body,
    parseEmailAddressFromBody,
    E.mapLeft(() => "You entered something that isn't a valid email address."),
    E.matchW(
      msg => res.status(400).send(oopsPage(msg)),
      email => {
        publish('send-member-number-to-email', email);
        res.status(200).send(checkYourMailPage(email));
      }
    )
  );
};
