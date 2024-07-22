import * as Sum from '@unsplash/sum-types';
import * as O from 'fp-ts/Option';
import {UUID} from 'io-ts-types';
import sanitize from 'sanitize-html';

export type Html = string & {readonly Html: unique symbol};

type SanitizedString = string & {
  readonly SanitizedString: unique symbol;
};

// Export required as we want to re-export the output of stuff like `export const loginLink = safe('/login')`
export type Safe = string & {readonly Safe: unique symbol};

export const sanitizeString = (input: string): SanitizedString =>
  sanitize(input, {
    // Given our usage of the library we want to escape everything.
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: 'recursiveEscape',
  }) as SanitizedString;

export const sanitizeOption = (
  data: O.Option<string | number>
): Safe | SanitizedString | number =>
  O.isSome(data)
    ? typeof data.value === 'string'
      ? sanitizeString(data.value)
      : data.value
    : safe('-');

export type HtmlSubstitution =
  | Html
  | number
  | SanitizedString
  | Safe
  | UUID
  | '';

export const joinHtml = (input: ReadonlyArray<HtmlSubstitution>) =>
  input.join('\n') as Html;

export const commaHtml = (input: ReadonlyArray<HtmlSubstitution>) =>
  input.join(', ') as Html;

export const safe = (input: string): Safe => input as Safe;

export const html = (
  literals: TemplateStringsArray,
  ...substitutions: ReadonlyArray<HtmlSubstitution>
): Html => {
  if (literals.length === 1 && substitutions.length === 0) {
    return literals[0] as Html;
  }
  let result = '';
  for (let index = 0; index < substitutions.length; index++) {
    result += literals[index];
    result += substitutions[index];
  }
  result += literals[substitutions.length];
  return result as Html;
};

export type CompleteHtmlDocument = Html & {
  readonly CompleteHtmlDocument: unique symbol;
};

interface Page {
  rendered: CompleteHtmlDocument;
}

interface Redirect {
  url: string;
}

export type HttpResponse =
  | Sum.Member<'Redirect', Redirect>
  | Sum.Member<'Page', Page>;

export const HttpResponse = Sum.create<HttpResponse>();
