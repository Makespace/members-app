
import * as O from 'fp-ts/Option';

export const registerOptionalDetailHelper = () => {
  Handlebars.registerHelper('optional_detail', (data: unknown) => {
    if (data !== null) {
      switch (typeof data) {
        case 'string':
        case 'bigint':
        case 'boolean':
          return data;
        case 'number':
          if (!isNaN(data)) {
            return data;
          }
          break;
        case 'symbol':
        case 'undefined':
        case 'function':
          break;
        case 'object':
          // Assume its an optional.
          if (
            'value' in data &&
            O.isSome(data as unknown as O.Option<unknown>)
          ) {
            return data.value;
          }
      }
    }
    return '—';
  });
};
