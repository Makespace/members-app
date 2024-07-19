

export const registerGridJs = () => {
  Handlebars.registerPartial(
    'gridjs',
    `
    <script>
      function initGrid(e) {
        const out = document.createElement("div");
        e.parentNode.insertBefore(out, e);

        const grid = new gridjs.Grid({
          from: e,
          search: true,
          language: {
            search: {
              placeholder: 'Search...',
            },
          },
        });
        grid.render(out);
      }

      const tables = document.querySelectorAll("table[data-gridjs]");
      for (const table of tables) {
        initGrid(table);
      }

    </script>
    `
  );
};
