import * as t from 'io-ts';

// A web address, or an empty string meaning "none recorded". Validated rather
// than taken on trust: these end up as links on a page and printed on signs
// stuck to machines, where a typo found at the form is free and one found on
// fifty posters is not. Only http and https - a javascript: or data: address
// in an href is somebody else's code running on our page.
export const webUrlOrEmpty = (name: string, subject: string) =>
  new t.Type<string, string, unknown>(
    name,
    (input): input is string => typeof input === 'string',
    (input, context) => {
      if (typeof input !== 'string') {
        return t.failure(input, context, `The ${subject} must be text`);
      }
      const trimmed = input.trim();
      if (trimmed === '') {
        return t.success('');
      }
      try {
        const url = new URL(trimmed);
        return url.protocol === 'http:' || url.protocol === 'https:'
          ? t.success(url.toString())
          : t.failure(input, context, `The ${subject} must be http or https`);
      } catch {
        return t.failure(input, context, 'That is not a web address');
      }
    },
    t.identity
  );
