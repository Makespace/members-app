import Handlebars from 'handlebars';

export const registerOptionalDetailHelper = () => {
  Handlebars.registerHelper('optional_detail', (data: unknown) =>
    data ? data : '—'
  );
};
