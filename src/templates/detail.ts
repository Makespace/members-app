Handlebars.registerHelper('optional_detail', (data: unknown) =>
  data ? data : '—'
);
