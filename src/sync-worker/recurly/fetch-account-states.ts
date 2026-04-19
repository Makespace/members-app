import * as E from 'fp-ts/Either';
import recurly from 'recurly';
import {EmailAddressCodec} from '../../types/email-address';

import {constructEvent} from '../../types/domain-event';

export const fetchRecurlyAccountStates = async (
    recurlyToken: string,
) => {
    const client = new recurly.Client(recurlyToken);
    const accounts = client.listAccounts();
    for await (const account of accounts.each()) {
        const {
            email,
            hasActiveSubscription,
            hasFutureSubscription,
            hasCanceledSubscription,
            hasPausedSubscription,
            hasPastDueInvoice,
        } = account;

        const maybeEmail = E.getOrElseW(() => undefined)(
            EmailAddressCodec.decode(email)
        );

        if (maybeEmail === undefined) {
            continue;
        }

        const event = constructEvent('RecurlySubscriptionUpdated')({
            email: maybeEmail,
            hasActiveSubscription: hasActiveSubscription ?? false,
            hasFutureSubscription: hasFutureSubscription ?? false,
            hasCanceledSubscription: hasCanceledSubscription ?? false,
            hasPausedSubscription: hasPausedSubscription ?? false,
            hasPastDueInvoice: hasPastDueInvoice ?? false,
            actor: {
                tag: 'system',
            },
        });

        updateState(event);
    }
}