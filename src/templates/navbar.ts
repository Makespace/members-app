import * as O from 'fp-ts/Option';
import {Area} from '../read-models/shared-state/return-types';
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

export const navBarViewModel = (areas: ReadonlyArray<Area>): NavBarViewModel => ({
  areas: areas
    .map(area => ({
      id: area.id,
      name: area.name,
      equipment: [...area.equipment]
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
    href: 'https://discord.gg/makespace',
    label: 'Discord',
    iconClass: 'fa-comments',
  },
  {
    href: 'https://groups.google.com/g/makespace',
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
    ${sanitizeString(area.name)}
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
              <div class="page-nav__tools" data-page-nav-tools>
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

const renderSitesPanel = () => html`
  <div
    id="page-nav-sites-panel"
    class="page-nav__panel page-nav__panel--sites"
    data-page-nav-panel="sites"
    hidden
  >
    <div class="page-nav__sites-menu">
      ${joinHtml(externalSiteLinks.map(renderSiteLink))}
    </div>
  </div>
`;

export const navBar = (
  user: User,
  isSuperUser: boolean,
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
        class="page-nav__menu page-nav__menu--areas"
        data-page-nav-menu="areas"
      >
        <button
          type="button"
          class="page-nav__control page-nav__control--primary"
          data-page-nav-toggle="areas"
          aria-expanded="false"
          aria-controls="page-nav-areas-panel"
        >
          Areas &amp; tools
        </button>
        ${renderAreasPanel(viewModel.areas)}
      </div>
      <div class="page-nav__secondary-actions">
        <a class="page-nav__action" href="/raise-issue">Raise an issue</a>
        <div
          class="page-nav__menu page-nav__menu--sites"
          data-page-nav-menu="sites"
        >
          <button
            type="button"
            class="page-nav__control page-nav__control--secondary"
            data-page-nav-toggle="sites"
            aria-expanded="false"
            aria-controls="page-nav-sites-panel"
          >
            Community
          </button>
          ${renderSitesPanel()}
        </div>
        ${isSuperUser ? html`<a class="page-nav__admin" href="/admin">Admin</a>` : html``}
      </div>
      <div class="page-nav__profile">${loggedInUserSquare(user)}</div>
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
        var hoverMedia = window.matchMedia(
          '(min-width: 48.01rem) and (hover: hover) and (pointer: fine)'
        );

        function setMenuOpen(name, isOpen) {
          var toggle = nav.querySelector('[data-page-nav-toggle="' + name + '"]');
          var panel = nav.querySelector('[data-page-nav-panel="' + name + '"]');
          if (!toggle || !panel) return;
          panel.hidden = !isOpen;
          toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
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
          toggle.addEventListener('click', function () {
            var name = toggle.getAttribute('data-page-nav-toggle');
            var panel = nav.querySelector('[data-page-nav-panel="' + name + '"]');
            if (!panel) return;
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
          });

          button.addEventListener('mouseenter', function () {
            if (usesHoverMenus()) {
              activateArea(button.getAttribute('data-area-id'));
            }
          });
        });

        document.addEventListener('click', function (event) {
          if (!nav.contains(event.target)) {
            closeMenus();
          }
        });

        document.addEventListener('keydown', function (event) {
          if (event.key === 'Escape') {
            closeMenus();
          }
        });
      })();
    </script>
  </nav>
`;
