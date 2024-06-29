import * as Sum from '@unsplash/sum-types';
import Handlebars from 'handlebars';
import {DateTime} from 'luxon';

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
  Handlebars.registerHelper('display_date', date => {
    // TODO Do this properly. https://github.com/Makespace/members-app/issues/40
    switch (typeof date) {
      case 'string':
        return date;
      case 'number':
        return DateTime.fromMillis(date).toLocaleString();
      default:
        if (date instanceof DateTime || date instanceof Date) {
          return date.toLocaleString();
        }
        return 'Unknown Date'; // Placeholder.
    }
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
