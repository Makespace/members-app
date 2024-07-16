/**
 * Centralise calling of the underlying template library (currently handlebars) so we can control provided options.
 */
import Handlebars from 'handlebars';

const knownHelpers: {[name: string]: true} = {};

export const compileTemplate = <T>(input: T) => {
  return Handlebars.compile(input, {
    // We enforce that a helper must be registered here before it can be used.
    knownHelpers: knownHelpers,
    knownHelpersOnly: true,
    // Unless in a SafeString everything should be escaped.
    noEscape: false,
    // Strict mode so that missing fields produce errors.
    strict: true,
    // Don't assume objects exist / throw if there are issues.
    assumeObjects: false,
    // Partials needing their own context prevents partials accidentally working because of a parent context in certain situations
    explicitPartialContext: true,
  });
};

export const registerPartialTemplate = (
  name: string,
  fn: Handlebars.Template
) => {
  Handlebars.registerPartial(name, fn);
};

export const registerHelper = (name: string, fn: Handlebars.HelperDelegate) => {
  // Note this enforces helpers to be registered before a template using them can be compiled which is what we want.
  Handlebars.registerHelper(name, fn);
  if (name in knownHelpers) {
    throw new Error(`Tried to register existing helper ${name} again`);
  }
  knownHelpers[name] = true;
};
