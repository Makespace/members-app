import * as O from 'fp-ts/Option';
import {
  MinimalArea,
  MinimalEquipment,
} from '../read-models/shared-state/return-types';
import {User} from '../types';
import {html, joinHtml, safe, sanitizeString} from '../types/html';
import {loggedInUserSquare} from './logged-in-user-square';

type NavBarEquipment = Readonly<{
  id: string;
  name: string;
}>;

type NavBarArea = Readonly<{
  id: string;
  name: string;
  equipment: ReadonlyArray<NavBarEquipment>;
}>;

export type NavBarViewModel = Readonly<{
  areas: ReadonlyArray<NavBarArea>;
}>;

const sortByName = <T extends {name: string}>(a: T, b: T) =>
  a.name.localeCompare(b.name);

const sortAreas = (a: NavBarArea, b: NavBarArea) => {
  const aHasTools = a.equipment.length > 0;
  const bHasTools = b.equipment.length > 0;
  return aHasTools === bHasTools ? sortByName(a, b) : aHasTools ? -1 : 1;
};

export const navBarViewModel = (
  areas: ReadonlyArray<MinimalArea>,
  getEquipmentForArea: (
    areaId: MinimalArea['id']
  ) => ReadonlyArray<MinimalEquipment>
): NavBarViewModel => ({
  areas: areas
    .map(area => ({
      id: area.id,
      name: area.name,
      equipment: [...getEquipmentForArea(area.id)]
        .filter(equipment => O.isNone(equipment.removedAt))
        .sort(sortByName)
        .map(equipment => ({id: equipment.id, name: equipment.name})),
    }))
    .sort(sortAreas),
});

const externalSiteLinks = [
  {
    href: 'https://equipment.makespace.org',
    label: 'Equipment website',
    iconClass: 'fa-compass',
  },
  {
    href: 'https://web.makespace.org',
    label: 'Makespace website',
    iconClass: 'fa-newspaper',
  },
  {
    href: 'https://www.meetup.com/makespace/',
    label: 'Meetup',
    iconClass: 'fa-calendar',
  },
  {
    href: 'https://groups.google.com/g/cammakespace',
    label: 'Google Groups',
    iconClass: 'fa-envelope',
  },
] as const;

const renderSiteLink = (link: (typeof externalSiteLinks)[number]) => html`
  <a
    class="page-nav__site-link"
    href="${safe(link.href)}"
    target="_blank"
    rel="noreferrer"
  >
    <span class="page-nav__site-icon" aria-hidden="true">
      <i class="fa-regular ${safe(link.iconClass)}"></i>
    </span>
    <span>${sanitizeString(link.label)}</span>
  </a>
`;

const renderAreaButton = (
  area: NavBarArea,
  isActive: boolean
) => html`
  <button
    type="button"
    class="page-nav__area-button${safe(isActive ? ' is-active' : '')}"
    data-page-nav-area-button
    data-area-id="${safe(area.id)}"
    data-area-href="/areas#area-${safe(area.id)}"
    aria-selected="${safe(isActive ? 'true' : 'false')}"
    aria-controls="page-nav-tools-${safe(area.id)}"
  >
    <span>${sanitizeString(area.name)}</span>
    <span class="page-nav__area-chevron" aria-hidden="true"></span>
  </button>
`;

const renderEmptyAreaLink = (area: NavBarArea) => html`
  <a
    class="page-nav__area-link page-nav__area-link--empty"
    href="/areas#area-${safe(area.id)}"
  >
    ${sanitizeString(area.name)}
  </a>
`;

const renderToolPanel = (
  area: NavBarArea,
  isActive: boolean
) => html`
  <section
    id="page-nav-tools-${safe(area.id)}"
    class="page-nav__tools-panel"
    data-page-nav-tools-panel
    data-area-id="${safe(area.id)}"
    data-active="${safe(isActive ? 'true' : 'false')}"
  >
    <div class="page-nav__tools-header">
      <h2 class="page-nav__tools-title">${sanitizeString(area.name)}</h2>
      <a class="page-nav__all-areas-link" href="/areas#area-${safe(area.id)}"
        >View area</a
      >
    </div>
    ${area.equipment.length > 0
      ? html`
          <ul class="page-nav__tool-list">
            ${joinHtml(
              area.equipment.map(equipment => html`
                <li>
                  <a href="/equipment/${safe(equipment.id)}"
                    >${sanitizeString(equipment.name)}</a
                  >
                </li>
              `)
            )}
          </ul>
        `
      : html`
          <p class="page-nav__empty-state">
            No equipment is currently listed in this area.
          </p>
        `}
  </section>
`;

const renderAreasPanel = (areas: ReadonlyArray<NavBarArea>) => {
  const areasWithTools = areas.filter(area => area.equipment.length > 0);
  const areasWithoutTools = areas.filter(area => area.equipment.length === 0);

  return html`
    <div
      id="page-nav-areas-panel"
      class="page-nav__panel page-nav__panel--areas"
      data-page-nav-panel="areas"
      hidden
    >
      <div class="page-nav__panel-intro">
        <a class="page-nav__all-areas-link" href="/areas">All areas</a>
        <!-- Future search stub: kept in the DOM for later implementation, but hidden on screen for now. -->
        <div class="page-nav__future-search">
          <label for="page-nav-search">Search tools or areas</label>
          <input
            id="page-nav-search"
            type="search"
            name="page-nav-search"
            placeholder="Search tools or areas"
          />
        </div>
        <!-- Future equipment catalogue stub: backed by a placeholder page, but intentionally hidden in this pass. -->
        <a class="page-nav__future-catalogue" href="/equipment-catalogue"
          >Equipment catalogue</a
        >
      </div>
      ${areas.length > 0
        ? html`
            <div class="page-nav__drilldown">
              <div class="page-nav__area-column">
                <div
                  class="page-nav__area-list"
                  aria-label="Makespace areas"
                >
                  ${joinHtml(
                    areasWithTools.map((area, index) =>
                      renderAreaButton(area, index === 0)
                    )
                  )}
                  ${areasWithoutTools.length > 0
                    ? html`
                        <div
                          class="page-nav__empty-area-list"
                          aria-label="Areas without listed tools"
                        >
                          ${joinHtml(areasWithoutTools.map(renderEmptyAreaLink))}
                        </div>
                      `
                    : html``}
                </div>
                <div
                  class="page-nav__area-scrollbar"
                  data-page-nav-area-scrollbar
                  aria-hidden="true"
                >
                  <span
                    class="page-nav__area-scrollbar-thumb"
                    data-page-nav-area-scrollbar-thumb
                  ></span>
                </div>
              </div>
              <div class="page-nav__tools" data-page-nav-tools>
                <button
                  type="button"
                  class="page-nav__mobile-area-back"
                  data-page-nav-area-back
                >
                  <span
                    class="page-nav__mobile-back-chevron"
                    aria-hidden="true"
                  ></span>
                  <span>Back to all areas</span>
                </button>
                ${joinHtml(
                  areasWithTools.map((area, index) =>
                    renderToolPanel(area, index === 0)
                  )
                )}
              </div>
            </div>
          `
        : html`
            <p class="page-nav__empty-state">
              No areas are currently available to browse.
            </p>
          `}
    </div>
  `;
};

export const renderCommunityLinks = () => html`
  <div class="page-nav__sites-menu">
    ${joinHtml(externalSiteLinks.map(renderSiteLink))}
    <div class="page-nav__site-link page-nav__site-link--unavailable">
      <span class="page-nav__site-icon" aria-hidden="true">
        <i class="fa-regular fa-comments"></i>
      </span>
      <span>Discord - link under review</span>
    </div>
  </div>
`;

const renderSitesPanel = () => html`
  <div
    id="page-nav-sites-panel"
    class="page-nav__panel page-nav__panel--sites"
    data-page-nav-panel="sites"
    hidden
  >
    ${renderCommunityLinks()}
  </div>
`;

const renderProfilePanel = () => html`
  <div
    id="page-nav-profile-panel"
    class="page-nav__panel page-nav__panel--profile"
    data-page-nav-panel="profile"
    hidden
  >
    <div class="page-nav__profile-menu">
      <a href="/me">
        <i class="fa-regular fa-circle-user" aria-hidden="true"></i>
        <span>Your Profile</span>
      </a>
      <a href="/log-out">
        <i class="fa-regular fa-share-from-square" aria-hidden="true"></i>
        <span>Log out</span>
      </a>
    </div>
  </div>
`;

export const navBar = (
  user: User,
  viewer: {isSuperUser: boolean; isOwner: boolean},
  viewModel: NavBarViewModel
) => html`
  <nav class="page-nav" data-page-nav>
    <div class="page-nav__row page-nav__row--primary">
      <a class="page-nav__home" href="/">
        <img
          width="64"
          height="64"
          src="/static/MS-LOGO-txpt-512.png"
          alt="Makespace"
          class="page-nav__logo"
        />
      </a>
      <div
        id="page-nav-areas-menu"
        class="page-nav__menu page-nav__menu--areas"
        data-page-nav-menu="areas"
      >
        <a
          href="/areas"
          class="page-nav__control page-nav__control--primary"
          data-page-nav-toggle="areas"
          aria-expanded="false"
          aria-controls="page-nav-areas-panel"
        >
          <span>Areas &amp; tools</span>
          <span class="page-nav__chevron" aria-hidden="true"></span>
        </a>
        ${renderAreasPanel(viewModel.areas)}
      </div>
      <div id="page-nav-secondary-actions" class="page-nav__secondary-actions">
        <a class="page-nav__action" href="/roadmap">Roadmap</a>
        <a class="page-nav__action" href="/raise-issue">Raise an issue</a>
        ${viewer.isSuperUser || viewer.isOwner
          ? html`<a class="page-nav__action" href="/trouble-tickets"
              >Trouble tickets</a
            >`
          : html``}
        <div
          class="page-nav__menu page-nav__menu--sites"
          data-page-nav-menu="sites"
        >
          <a
            href="/community"
            class="page-nav__control page-nav__control--secondary"
            data-page-nav-toggle="sites"
            aria-expanded="false"
            aria-controls="page-nav-sites-panel"
          >
            <span>Community</span>
            <span class="page-nav__chevron" aria-hidden="true"></span>
          </a>
          ${renderSitesPanel()}
        </div>
        ${viewer.isSuperUser
          ? html`<a class="page-nav__admin" href="/admin">Admin</a>`
          : html``}
      </div>
      <button
        type="button"
        class="jsonly page-nav__mobile-menu-toggle"
        data-page-nav-mobile-toggle
        aria-expanded="false"
        aria-controls="page-nav-areas-menu page-nav-secondary-actions"
        aria-label="Open menu"
      >
        <span class="page-nav__mobile-menu-label">Menu</span>
        <span class="page-nav__mobile-menu-close" aria-hidden="true"></span>
      </button>
      <div
        class="page-nav__profile page-nav__menu page-nav__menu--profile"
        data-page-nav-menu="profile"
      >
        ${loggedInUserSquare(user)} ${renderProfilePanel()}
      </div>
    </div>
    <div class="page-nav__row page-nav__row--secondary">
      <a
        class="jsonly page-nav__back"
        href="/me"
        onclick="if (window.history.length > 1) { window.history.back(); return false; }"
        >Back</a
      >
    </div>
    <script>
      (function () {
        var nav = document.currentScript && document.currentScript.closest('[data-page-nav]');
        if (!nav) return;

        var menuWrappers = nav.querySelectorAll('[data-page-nav-menu]');
        var toggles = nav.querySelectorAll('[data-page-nav-toggle]');
        var areaButtons = nav.querySelectorAll('[data-page-nav-area-button]');
        var toolPanels = nav.querySelectorAll('[data-page-nav-tools-panel]');
        var drilldown = nav.querySelector('.page-nav__drilldown');
        var areaList = nav.querySelector('.page-nav__area-list');
        var areaScrollbar = nav.querySelector('[data-page-nav-area-scrollbar]');
        var areaScrollbarThumb = nav.querySelector(
          '[data-page-nav-area-scrollbar-thumb]'
        );
        var areaBackButton = nav.querySelector('[data-page-nav-area-back]');
        var mobileMenuToggle = nav.querySelector('[data-page-nav-mobile-toggle]');
        var lastAreaButton = null;
        // Must match the layout breakpoint in styles.css.
        var breakpointRem = 48;
        var hoverMedia = window.matchMedia(
          '(min-width: ' + (breakpointRem + 0.01) + 'rem) and (hover: hover) and (pointer: fine)'
        );
        var mobileMedia = window.matchMedia('(max-width: ' + breakpointRem + 'rem)');

        nav.classList.add('has-mobile-menu');

        function setMenuOpen(name, isOpen) {
          var toggle = nav.querySelector('[data-page-nav-toggle="' + name + '"]');
          var panel = nav.querySelector('[data-page-nav-panel="' + name + '"]');
          if (!toggle || !panel) return;
          panel.hidden = !isOpen;
          toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
          if (name === 'areas' && !isOpen && drilldown) {
            drilldown.classList.remove('is-showing-tools');
            drilldown.classList.remove('is-returning-to-areas');
          }
          if (name === 'areas' && isOpen && areaList) {
            window.requestAnimationFrame(updateAreaScrollbar);
          }
        }

        function closeMenus() {
          toggles.forEach(function (toggle) {
            setMenuOpen(toggle.getAttribute('data-page-nav-toggle'), false);
          });
        }

        function openMenu(name) {
          toggles.forEach(function (toggle) {
            var toggleName = toggle.getAttribute('data-page-nav-toggle');
            setMenuOpen(toggleName, toggleName === name);
          });
        }

        function usesHoverMenus() {
          return hoverMedia.matches;
        }

        function usesMobileDrilldown() {
          return mobileMedia.matches;
        }

        function setMobileMenuOpen(isOpen) {
          nav.classList.toggle('is-mobile-menu-open', isOpen);
          if (!mobileMenuToggle) return;
          mobileMenuToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
          mobileMenuToggle.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
          if (!isOpen) closeMenus();
        }

        mobileMedia.addEventListener('change', function (event) {
          if (!event.matches) setMobileMenuOpen(false);
        });

        function updateAreaScrollbar() {
          if (!areaList || !areaScrollbar || !areaScrollbarThumb) return;
          var scrollRange = areaList.scrollHeight - areaList.clientHeight;
          areaScrollbar.hidden = scrollRange <= 1;
          if (scrollRange <= 1) return;

          var trackHeight = areaScrollbar.clientHeight;
          var thumbHeight = Math.max(
            32,
            trackHeight * (areaList.clientHeight / areaList.scrollHeight)
          );
          var thumbRange = trackHeight - thumbHeight;
          var thumbTop = thumbRange * (areaList.scrollTop / scrollRange);
          areaScrollbarThumb.style.height = thumbHeight + 'px';
          areaScrollbarThumb.style.transform =
            'translateY(' + thumbTop + 'px)';
        }

        function activateArea(areaId) {
          areaButtons.forEach(function (button) {
            var matches = button.getAttribute('data-area-id') === areaId;
            button.setAttribute('aria-selected', matches ? 'true' : 'false');
            button.classList.toggle('is-active', matches);
          });
          toolPanels.forEach(function (panel) {
            var matches = panel.getAttribute('data-area-id') === areaId;
            panel.setAttribute('data-active', matches ? 'true' : 'false');
          });
        }

        toggles.forEach(function (toggle) {
          toggle.addEventListener('click', function (event) {
            var name = toggle.getAttribute('data-page-nav-toggle');
            var panel = nav.querySelector('[data-page-nav-panel="' + name + '"]');
            if (!panel) return;
            if (usesHoverMenus() && name === 'profile') return;
            event.preventDefault();
            if (usesHoverMenus()) {
              openMenu(name);
              return;
            }
            setMenuOpen(name, panel.hidden);
          });
        });

        menuWrappers.forEach(function (wrapper) {
          var name = wrapper.getAttribute('data-page-nav-menu');
          wrapper.addEventListener('mouseenter', function () {
            if (usesHoverMenus()) {
              openMenu(name);
            }
          });
          wrapper.addEventListener('mouseleave', function () {
            if (usesHoverMenus()) {
              setMenuOpen(name, false);
            }
          });
        });

        areaButtons.forEach(function (button) {
          button.addEventListener('click', function () {
            if (usesHoverMenus()) {
              var areaHref = button.getAttribute('data-area-href');
              if (areaHref) {
                window.location.assign(areaHref);
                return;
              }
            }
            activateArea(button.getAttribute('data-area-id'));
            if (usesMobileDrilldown() && drilldown) {
              lastAreaButton = button;
              drilldown.classList.remove('is-returning-to-areas');
              drilldown.classList.add('is-showing-tools');
              if (areaBackButton) areaBackButton.focus();
            }
          });

          button.addEventListener('mouseenter', function () {
            if (usesHoverMenus()) {
              activateArea(button.getAttribute('data-area-id'));
            }
          });
        });

        if (areaBackButton) {
          areaBackButton.addEventListener('click', function () {
            if (!drilldown) return;
            drilldown.classList.add('is-returning-to-areas');
            drilldown.classList.remove('is-showing-tools');
            if (lastAreaButton) lastAreaButton.focus();
          });
        }

        if (areaList) {
          areaList.addEventListener('scroll', updateAreaScrollbar);
          areaList.addEventListener('animationend', function () {
            if (drilldown) {
              drilldown.classList.remove('is-returning-to-areas');
            }
          });
        }

        window.addEventListener('resize', updateAreaScrollbar);

        if (areaScrollbar && areaScrollbarThumb && areaList) {
          var dragStartY = 0;
          var dragStartScroll = 0;

          areaScrollbar.addEventListener('click', function (event) {
            if (event.target === areaScrollbarThumb) return;
            var rect = areaScrollbar.getBoundingClientRect();
            var thumbHeight = areaScrollbarThumb.offsetHeight;
            var thumbRange = areaScrollbar.clientHeight - thumbHeight;
            if (thumbRange <= 0) return;
            var scrollRange = areaList.scrollHeight - areaList.clientHeight;
            var target = event.clientY - rect.top - thumbHeight / 2;
            areaList.scrollTop =
              scrollRange * Math.max(0, Math.min(1, target / thumbRange));
          });

          areaScrollbarThumb.addEventListener('pointerdown', function (event) {
            event.preventDefault();
            dragStartY = event.clientY;
            dragStartScroll = areaList.scrollTop;
            areaScrollbarThumb.setPointerCapture(event.pointerId);
            areaScrollbarThumb.classList.add('is-dragging');
          });

          areaScrollbarThumb.addEventListener('pointermove', function (event) {
            if (!areaScrollbarThumb.hasPointerCapture(event.pointerId)) return;
            var thumbRange =
              areaScrollbar.clientHeight - areaScrollbarThumb.offsetHeight;
            if (thumbRange <= 0) return;
            var scrollRange = areaList.scrollHeight - areaList.clientHeight;
            areaList.scrollTop =
              dragStartScroll +
              (event.clientY - dragStartY) * (scrollRange / thumbRange);
          });

          var endThumbDrag = function (event) {
            if (areaScrollbarThumb.hasPointerCapture(event.pointerId)) {
              areaScrollbarThumb.releasePointerCapture(event.pointerId);
            }
            areaScrollbarThumb.classList.remove('is-dragging');
          };

          areaScrollbarThumb.addEventListener('pointerup', endThumbDrag);
          areaScrollbarThumb.addEventListener('pointercancel', endThumbDrag);
        }

        if (mobileMenuToggle) {
          mobileMenuToggle.addEventListener('click', function () {
            setMobileMenuOpen(
              mobileMenuToggle.getAttribute('aria-expanded') !== 'true'
            );
          });
        }

        document.addEventListener('click', function (event) {
          if (!nav.contains(event.target)) {
            closeMenus();
            if (usesMobileDrilldown()) setMobileMenuOpen(false);
          }
        });

        document.addEventListener('keydown', function (event) {
          if (event.key === 'Escape') {
            closeMenus();
            if (usesMobileDrilldown()) {
              setMobileMenuOpen(false);
              if (mobileMenuToggle) mobileMenuToggle.focus();
            }
          }
        });
      })();
    </script>
  </nav>
`;
