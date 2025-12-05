import {html} from '../types/html';

export const memberSelectorJs = () => html`
  <script>
    (function () {
      function initMemberSelector(container) {
        const searchInput = container.querySelector('[data-search-input]');
        const valueInput = container.querySelector('[data-member-value]');
        const dropdown = container.querySelector('[data-dropdown]');
        const memberList = container.querySelector('[data-member-list]');
        const selectedDisplay = container.querySelector(
          '[data-selected-display]'
        );
        const selectedText = container.querySelector('[data-selected-text]');
        const clearBtn = container.querySelector('[data-clear-btn]');
        const membersScript = container.querySelector('[data-members]');

        const members = JSON.parse(membersScript.textContent);
        let highlightedIndex = -1;

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
          const li = document.createElement('li');
          li.className = 'member-selector__item';
          li.dataset.memberNumber = member.memberNumber;

          const img = document.createElement('img');
          img.src = getGravatarUrl(member.gravatarHash, 32);
          img.width = 32;
          img.height = 32;
          img.alt = '';
          img.loading = 'lazy';

          const info = document.createElement('span');
          info.className = 'member-selector__info';
          const displayName = member.name || 'Unknown';
          info.textContent =
            displayName + ' (#' + member.memberNumber + ') ' + member.email;

          li.appendChild(img);
          li.appendChild(info);
          return li;
        }

        function filterMembers(query) {
          const q = query.toLowerCase().trim();
          if (!q) return members.slice(0, 50);
          return members.filter(function (m) {
            return (
              (m.name && m.name.toLowerCase().includes(q)) ||
              m.email.toLowerCase().includes(q) ||
              String(m.memberNumber).includes(q)
            );
          });
        }

        function showDropdown(filtered) {
          memberList.innerHTML = '';
          highlightedIndex = -1;

          if (filtered.length === 0) {
            const li = document.createElement('li');
            li.className = 'member-selector__no-results';
            li.textContent = 'No members found';
            memberList.appendChild(li);
          } else {
            filtered.forEach(function (member) {
              const li = renderMemberItem(member);
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
          const displayName = member.name || 'Unknown';
          valueInput.value = member.memberNumber;
          selectedText.textContent =
            displayName + ' (#' + member.memberNumber + ') ' + member.email;
          searchInput.value = '';
          searchInput.hidden = true;
          selectedDisplay.hidden = false;
          hideDropdown();
        }

        function clearSelection() {
          valueInput.value = '';
          selectedText.textContent = '';
          searchInput.hidden = false;
          selectedDisplay.hidden = true;
          searchInput.focus();
        }

        function highlightItem(index) {
          const items = memberList.querySelectorAll('.member-selector__item');
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
          const filtered = filterMembers(searchInput.value);
          showDropdown(filtered);
        });

        searchInput.addEventListener('focus', function () {
          if (!valueInput.value) {
            const filtered = filterMembers(searchInput.value);
            showDropdown(filtered);
          }
        });

        searchInput.addEventListener('keydown', function (e) {
          const items = memberList.querySelectorAll('.member-selector__item');
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            highlightedIndex = Math.min(highlightedIndex + 1, items.length - 1);
            highlightItem(highlightedIndex);
          } else if (e.key === 'ArrowUp') {
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

        clearBtn.addEventListener('click', clearSelection);

        document.addEventListener('click', function (e) {
          if (!container.contains(e.target)) {
            hideDropdown();
          }
        });
      }

      document
        .querySelectorAll('[data-member-selector]')
        .forEach(initMemberSelector);
    })();
  </script>
`;
