import * as O from 'fp-ts/Option';
import {gravatarHashFromEmail} from '../read-models/members/avatar';
import {html, Html, Safe, sanitizeString} from '../types/html';
import {EmailAddress, GravatarHash, isoGravatarHash} from '../types';

type SelectableMember = {
  memberNumber: number;
  emailAddress: EmailAddress;
  name: O.Option<string>;
  gravatarHash?: GravatarHash;
};

const getGravatarHashString = (member: SelectableMember): string => {
  if (member.gravatarHash) {
    return isoGravatarHash.unwrap(member.gravatarHash);
  }
  return isoGravatarHash.unwrap(gravatarHashFromEmail(member.emailAddress));
};

const memberSelectorScript = () => html`
  <script>
    (function () {
      function initMemberSelector(container) {
        var searchInput = container.querySelector('[data-search-input]');
        var valueInput = container.querySelector('[data-member-value]');
        var dropdown = container.querySelector('[data-dropdown]');
        var memberList = container.querySelector('[data-member-list]');
        var membersScript = container.querySelector('[data-members]');

        var members = JSON.parse(membersScript.textContent);
        var highlightedIndex = -1;
        var isSelected = false;

        function getGravatarUrl(hash, size) {
          return (
            'https://www.gravatar.com/avatar/' +
            hash +
            '?s=' +
            size +
            '&d=identicon'
          );
        }

        function renderMemberItem(member) {
          var li = document.createElement('li');
          li.className = 'member-selector__item';
          li.dataset.memberNumber = member.memberNumber;

          var img = document.createElement('img');
          img.src = getGravatarUrl(member.gravatarHash, 32);
          img.width = 32;
          img.height = 32;
          img.alt = '';
          img.loading = 'lazy';

          var info = document.createElement('span');
          info.className = 'member-selector__info';
          var displayName = member.name || 'Unknown';
          info.textContent = displayName + ' (#' + member.memberNumber + ')';

          li.appendChild(img);
          li.appendChild(info);
          return li;
        }

        function filterMembers(query) {
          var q = query.toLowerCase().trim();
          if (!q) return members.slice(0, 50);
          return members
            .filter(function (m) {
              return (
                (m.name && m.name.toLowerCase().includes(q)) ||
                String(m.memberNumber).includes(q)
              );
            })
            .slice(0, 50);
        }

        function showDropdown(filtered) {
          memberList.innerHTML = '';
          highlightedIndex = -1;

          if (filtered.length === 0) {
            var li = document.createElement('li');
            li.className = 'member-selector__no-results';
            li.textContent = 'No members found';
            memberList.appendChild(li);
          } else {
            filtered.forEach(function (member) {
              var li = renderMemberItem(member);
              li.addEventListener('click', function () {
                selectMember(member);
              });
              memberList.appendChild(li);
            });
          }
          dropdown.hidden = false;
        }

        function hideDropdown() {
          dropdown.hidden = true;
          highlightedIndex = -1;
        }

        function selectMember(member) {
          var displayName = member.name || 'Unknown';
          valueInput.value = member.memberNumber;
          searchInput.value = displayName + ' (#' + member.memberNumber + ')';
          searchInput.classList.add('member-selector__search--selected');
          isSelected = true;
          hideDropdown();
        }

        function clearSelection() {
          valueInput.value = '';
          searchInput.value = '';
          searchInput.classList.remove('member-selector__search--selected');
          isSelected = false;
        }

        function highlightItem(index) {
          var items = memberList.querySelectorAll('.member-selector__item');
          items.forEach(function (item, i) {
            item.classList.toggle(
              'member-selector__item--highlighted',
              i === index
            );
          });
          if (items[index]) {
            items[index].scrollIntoView({block: 'nearest'});
          }
        }

        searchInput.addEventListener('input', function () {
          if (isSelected) {
            clearSelection();
          }
          var filtered = filterMembers(searchInput.value);
          showDropdown(filtered);
        });

        searchInput.addEventListener('focus', function () {
          if (isSelected) {
            searchInput.select();
          } else {
            var filtered = filterMembers(searchInput.value);
            showDropdown(filtered);
          }
        });

        searchInput.addEventListener('keydown', function (e) {
          var items = memberList.querySelectorAll('.member-selector__item');
          if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
            e.preventDefault();
            highlightedIndex = Math.min(highlightedIndex + 1, items.length - 1);
            highlightItem(highlightedIndex);
          } else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
            e.preventDefault();
            highlightedIndex = Math.max(highlightedIndex - 1, 0);
            highlightItem(highlightedIndex);
          } else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightedIndex >= 0 && items[highlightedIndex]) {
              items[highlightedIndex].click();
            }
          } else if (e.key === 'Escape') {
            hideDropdown();
          }
        });

        document.addEventListener('click', function (e) {
          if (!container.contains(e.target)) {
            hideDropdown();
          }
        });
      }

      document
        .querySelectorAll('[data-member-selector]:not([data-initialized])')
        .forEach(function (container) {
          container.setAttribute('data-initialized', 'true');
          initMemberSelector(container);
        });
    })();
  </script>
`;

export const memberSelector = (
  fieldName: Safe,
  label: Safe | null,
  members: ReadonlyArray<SelectableMember>
): Html => {
  const membersJson = JSON.stringify(
    members.map(m => ({
      memberNumber: m.memberNumber,
      name: O.isSome(m.name) ? m.name.value : null,
      gravatarHash: getGravatarHashString(m),
    }))
  );

  return html`
    <div class="member-selector" data-member-selector>
      ${label ? html`<label for="${fieldName}-search">${label}</label>` : ''}
      <div class="member-selector__container">
        <input
          type="text"
          id="${fieldName}-search"
          class="member-selector__search"
          placeholder="Search by name or member number..."
          autocomplete="off"
          data-search-input
        />
        <input type="hidden" name="${fieldName}" data-member-value />
        <div class="member-selector__dropdown" data-dropdown hidden>
          <ul class="member-selector__list" data-member-list></ul>
        </div>
      </div>
      <script data-members type="application/json">
        ${sanitizeString(membersJson)}
      </script>
      ${memberSelectorScript()}
    </div>
  `;
};
