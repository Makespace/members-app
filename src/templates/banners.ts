import {Html, html, joinHtml, safe, sanitizeString} from '../types/html';
import {Notification} from '../read-models/shared-state/notifications/get';
import {Member} from '../read-models/shared-state/return-types';
import {ownerAgreementStatus} from '../owner-agreement/agreement';
import {displayDateOnly} from './display-date';

// One banner, ready to render. System banners (derived from member state,
// like the unsigned owner's agreement) and stored notifications both reduce
// to this shape.
export type Banner = {
  bannerType: 'action' | 'event' | 'info';
  title: string;
  message: string;
  linkUrl: string | null;
  linkLabel: string | null;
  // Present only for stored, dismissable notifications.
  dismissableId: string | null;
};

const agreementLink = '/members/sign-owner-agreement';

const date = (value: Date) => String(displayDateOnly(value));

// What an owner is asked to do about the Owners' Agreement, if anything.
// The wording for those who signed only the original agreement is gentle
// for now; it becomes a firmer ask once everyone has had time to read it.
const ownerAgreementBanner = (
  member: Member,
  now: Date
): Banner | null => {
  if (member.ownerOf.length === 0) {
    return null;
  }
  const status = ownerAgreementStatus(member.ownerAgreement, now);
  const banner = (
    title: string,
    message: string,
    linkLabel: string
  ): Banner => ({
    bannerType: 'action',
    title,
    message,
    linkUrl: agreementLink,
    linkLabel,
    dismissableId: null,
  });
  switch (status.state) {
    case 'unsigned':
      return banner(
        "Please sign the Owners' Agreement",
        'As an owner you need to read and sign the agreement.',
        'Read and sign it now'
      );
    case 'outdated':
      return banner(
        "There's a new Owners' Agreement",
        "Please have a read, and sign it if you're happy with it.",
        'Read the new agreement'
      );
    case 'renewal-due':
      return banner(
        "Time to renew your Owners' Agreement",
        `Your term ends on ${date(status.termEnds)}.`,
        'Read and re-sign it'
      );
    case 'lapsed':
      return banner(
        "Your Owners' Agreement has lapsed",
        `Your term ended on ${date(status.termEnds)}.`,
        'Read and re-sign it'
      );
    case 'signed':
      return null;
  }
};

// Banners derived from the member's own state rather than stored
// notifications. Non-dismissable by nature: they disappear when the
// underlying condition is resolved.
export const systemBanners = (
  member: Member,
  now: Date
): ReadonlyArray<Banner> => {
  const banners: Banner[] = [];
  const agreement = ownerAgreementBanner(member, now);
  if (agreement) {
    banners.push(agreement);
  }
  return banners;
};

export const toBanner = (notification: Notification): Banner => ({
  bannerType: notification.bannerType,
  title: notification.title,
  message: notification.message,
  linkUrl: notification.linkUrl,
  linkLabel: notification.linkLabel,
  dismissableId: notification.dismissable ? notification.id : null,
});

const renderBanner = (
  banner: Banner,
  alternate: boolean,
  currentPath: string
): Html => html`
  <aside
    class="site-banner site-banner--${safe(banner.bannerType)}${alternate
      ? safe(' site-banner--alt')
      : ''}"
  >
    <div class="site-banner__body">
      <strong>${sanitizeString(banner.title)}</strong>
      ${banner.message ? html` ${sanitizeString(banner.message)}` : ''}
      ${banner.linkUrl
        ? html` <a href="${sanitizeString(banner.linkUrl)}"
            >${sanitizeString(banner.linkLabel ?? banner.linkUrl)}</a
          >`
        : ''}
    </div>
    ${banner.dismissableId
      ? html`
          <form
            action="/notifications/dismiss?next=${safe(
              encodeURIComponent(currentPath)
            )}"
            method="post"
            class="site-banner__dismiss"
          >
            <input
              type="hidden"
              name="notificationId"
              value="${safe(banner.dismissableId)}"
            />
            <button type="submit" aria-label="Dismiss this notification">
              ✕
            </button>
          </form>
        `
      : ''}
  </aside>
`;

// The banner stack. Adjacent banners of the same type alternate a shade so
// each one reads as distinct.
export const renderBanners = (
  banners: ReadonlyArray<Banner>,
  currentPath: string
): Html => {
  if (banners.length === 0) {
    return html``;
  }
  let previousType: string | null = null;
  let alternate = false;
  const rendered = banners.map(banner => {
    alternate = banner.bannerType === previousType ? !alternate : false;
    previousType = banner.bannerType;
    return renderBanner(banner, alternate, currentPath);
  });
  return html`<div class="site-banners">${joinHtml(rendered)}</div>`;
};
