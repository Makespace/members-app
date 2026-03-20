import { faker } from "@faker-js/faker";
import { magicLink } from "../../src/authentication";
import { Config } from "../../src/configuration";
import { User } from "../../src/types/user";
import { EmailAddress } from "../../src/types";
import { createEmailVerificationLink, decodeEmailVerificationLink } from "../../src/authentication/verify-email/email-verification-link";
import * as E from 'fp-ts/Either';
import pino from "pino";
import { Request } from 'express';
import { decodeMagicLinkFromQuery } from "../../src/authentication/login/magic-link";
import { getRightOrFail } from "../helpers";

const reqWithQuery = (link: string): Request => ({
    query: Object.fromEntries(new URL(link).searchParams.entries())
} as unknown as Request);

describe('magic links', () => {
    const conf = {
        TOKEN_SECRET: 'secret',
        PUBLIC_URL: 'https://members.makespace.example',
    } as Config;
    const logger = pino({level: 'silent'});

    describe('generates a login and a verification link', () => {
        const user: User = {
            emailAddress: faker.internet.email() as EmailAddress,
            memberNumber: faker.number.int(),
        };
        let loginLink: string;
        let verificationLink: string;
        beforeEach(() => {
            loginLink = magicLink.create(conf)(user);
            verificationLink = createEmailVerificationLink(conf)(user);
        });

        it('login link does not decode as an email verification link', () => {
            const req = reqWithQuery(loginLink);
            expect(E.isLeft(decodeEmailVerificationLink(logger, conf)(req))).toBeTruthy();
        });

        it('email verification link does not decode as a login link', () => {
            const req = reqWithQuery(verificationLink);
            expect(E.isLeft(decodeMagicLinkFromQuery(logger, conf)(req.query))).toBeTruthy();
        });

        it('login link does decode as an login link', () => {
            const req = reqWithQuery(loginLink);
            expect(getRightOrFail(decodeMagicLinkFromQuery(logger, conf)(req.query))).toStrictEqual(user);
        });

        it('email verification link does decode as an email verification link', () => {
            const req = reqWithQuery(verificationLink);
            expect(getRightOrFail(decodeEmailVerificationLink(logger, conf)(req))).toStrictEqual(user);
        });
    });

});