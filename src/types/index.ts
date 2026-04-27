import { UUID } from 'io-ts-types';

export type {EmailAddress} from './email-address';
export {EmailAddressCodec} from './email-address';
export type {Failure} from './failure';
export {failure} from './failure';
export type {Email} from './email';
export {User} from './user';
export {Actor} from './actor';
export {HttpResponse} from './html';
export type {GravatarHash} from './gravatar-hash';
export {isoGravatarHash} from './gravatar-hash';
export {
  DomainEvent,
  StoredDomainEvent,
  isEventOfType,
  constructEvent,
} from './domain-event';
export type {
  DeletedStoredDomainEvent,
  StoredEventOfType,
} from './domain-event';
export type UserId = UUID;
