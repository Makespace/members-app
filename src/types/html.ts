import * as Sum from '@unsplash/sum-types';
import sanitize from 'sanitize-html';

export type Html = string & {readonly Html: unique symbol};

type SanitizedString = string & {readonly SanitizedString: unique symbol};

type Safe = string & {readonly Safe: unique symbol};

export const sanitizeString = (input: string): SanitizedString =>
  sanitize(input) as SanitizedString;

export const joinHtml = (input: ReadonlyArray<Html>) =>
  input.join('\n') as Html;

export const safe = (
  literals: TemplateStringsArray,
  ...substitutions: ReadonlyArray<string | Html | SanitizedString>
): Safe => {
  if (literals.length === 1 && substitutions.length === 0) {
    return literals[0] as Safe;
  }
  let result = '';
  for (let index = 0; index < substitutions.length; index++) {
    result += literals[index];
    result += substitutions[index];
  }
  result += literals[substitutions.length];
  return result as Safe;
};

export const html = (
  literals: TemplateStringsArray,
  ...substitutions: ReadonlyArray<Html | number | SanitizedString | Safe>
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

interface Page {
  html: string;
}

interface Redirect {
  url: string;
}

export type HttpResponse =
  | Sum.Member<'Redirect', Redirect>
  | Sum.Member<'Page', Page>;
export const HttpResponse = Sum.create<HttpResponse>();
