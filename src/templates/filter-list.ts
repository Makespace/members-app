import Handlebars, {HelperOptions} from 'handlebars';

export const registerFilterListHelper = () => {
  Handlebars.registerHelper(
    'filterList',
    (context: ReadonlyArray<unknown>, name: string, options: HelperOptions) => {
      const prefix = `
    <table data-gridjs>
      <thead>
        <tr>
          <th>${name}</th>
        </tr>
      </thead>
      <tbody>
    `;

      const suffix = `
      </tbody>
    </table>
    `;

      const rows = [];
      for (const item of context) {
        rows.push(`<tr><td>${options.fn(item)}</td></tr>`);
      }

      return prefix + rows.join('') + suffix;
    }
  );
};
