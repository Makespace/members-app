import * as O from 'fp-ts/Option';
import {body as original} from './2024-original';
import {pages as october2026} from './2026-10';
import {AgreementPage} from './types';

export type {AgreementPage} from './types';

// Every version of the Owners' Agreement there has been, oldest first. A
// signature records the key of the version signed, so what someone agreed to
// can always be read back. To publish a new version, add it to the end; the
// last one is the version owners are asked to sign.
export type AgreementVersion = {
  key: string;
  title: string;
  // How long a signature lasts before it needs renewing; null if it doesn't.
  termMonths: number | null;
  pages: ReadonlyArray<AgreementPage>;
};

// Signatures from before versioning were all of the original agreement.
export const ORIGINAL_AGREEMENT_KEY = '2024-original';

export const agreementVersions: ReadonlyArray<AgreementVersion> = [
  {
    key: ORIGINAL_AGREEMENT_KEY,
    title: 'The original agreement (2024)',
    termMonths: null,
    pages: [{label: 'The agreement', body: original}],
  },
  {
    key: '2026-10',
    title: 'The Owners’ Agreement (October 2026)',
    termMonths: 6,
    pages: october2026,
  },
];

export const currentAgreement = agreementVersions[agreementVersions.length - 1];

export const findAgreementVersion = (key: string): O.Option<AgreementVersion> =>
  O.fromNullable(agreementVersions.find(version => version.key === key));
