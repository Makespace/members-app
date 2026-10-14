import {initRoutes} from '../../src/routes';
import {Dependencies} from '../../src/dependencies';
import {Config} from '../../src/configuration';

// A route with a parameter in it matches anything in that position, so a
// later route whose fixed word sits there is never reached. Express answers
// with whichever was registered first, and the symptom is a page that insists
// a real thing does not exist - /trouble-tickets/raise read as a ticket id
// called "raise".
//
// This is not hypothetical: the mailbox routes already carry a comment about
// it, and the trouble tickets ones were shipped broken anyway. So it is
// checked rather than remembered.

const routes = initRoutes(
  {} as unknown as Dependencies,
  {MANAGEMENT_TEAM_AREA_ID: 'none'} as unknown as Config
);

// "/a/:id" -> /^\/a\/[^/]+$/, so it can be tried against a fixed path.
const asPattern = (path: string) =>
  new RegExp(
    `^${path
      .split('/')
      .map(part => (part.startsWith(':') ? '[^/]+' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
      .join('/')}$`
  );

const hasParameter = (path: string) => path.includes('/:');

describe('routes that would swallow each other', () => {
  it('never puts a pattern ahead of a fixed path it would match', () => {
    const shadowed: string[] = [];

    routes.forEach((route, index) => {
      if (!hasParameter(route.path)) {
        return;
      }
      const pattern = asPattern(route.path);
      routes.slice(index + 1).forEach(later => {
        if (
          later.method === route.method &&
          !hasParameter(later.path) &&
          pattern.test(later.path)
        ) {
          shadowed.push(
            `${later.method.toUpperCase()} ${later.path} is unreachable: ${route.path} is registered first and matches it`
          );
        }
      });
    });

    expect(shadowed).toStrictEqual([]);
  });
});
