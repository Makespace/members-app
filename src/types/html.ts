import * as Sum from '@unsplash/sum-types';
import Handlebars from 'handlebars';

const initHelpers = () => {
  Handlebars.registerHelper('member_number', memberNumber => {
    // This may not be strictly needed as memberNumber should always be a number but following the approach of escaping everything going to end users.
    const escapedMemberNumber = Handlebars.escapeExpression(
      memberNumber as string
    );
    return new Handlebars.SafeString(
      '<a class=memberNumberLink href=/member/' +
        escapedMemberNumber +
        '/><b>' +
        escapedMemberNumber +
        '</b></a>'
    );
  });
};

initHelpers();

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

// Deprecated.
export const html = (
  literals: TemplateStringsArray,
  ...substitutions: ReadonlyArray<string | number>
): string => {
  if (literals.length === 1 && substitutions.length === 0) {
    return literals[0];
  }
  let result = '';
  for (let index = 0; index < substitutions.length; index++) {
    result += literals[index];
    result += substitutions[index];
  }
  result += literals[substitutions.length];
  return result;
};
