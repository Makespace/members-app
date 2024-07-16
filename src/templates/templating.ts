/**
 * Centralise calling of the underlying template library (currently handlebars) so we can control provided options.
 */
import Handlebars from 'handlebars';

class TemplateContext {
  private knownHelpers: {[name: string]: true} = {};
  private handlebars: typeof Handlebars;

  constructor() {
    this.handlebars = Handlebars.create();
  }

  compileTemplate = <T>(input: T) => {
    const template = this.handlebars.compile(input, {
      // We enforce that a helper must be registered here before it can be used.
      knownHelpers: this.knownHelpers,
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
    // TODO - Can we do any further checking with the template here?
    return template;
  };

  registerPartialTemplate = (name: string, fn: Handlebars.Template) => {
    this.handlebars.registerPartial(name, fn);
  };

  registerHelper = (name: string, fn: Handlebars.HelperDelegate) => {
    // Note this enforces helpers to be registered before a template using them can be compiled which is what we want.
    this.handlebars.registerHelper(name, fn);
    if (name in this.knownHelpers) {
      throw new Error(`Tried to register existing helper ${name} again`);
    }
    this.knownHelpers[name] = true;
  };
}

// Wrap global stuff away in a single Global object which makes isolating context between tests easier while
// still giving the benefits of a global object.
export const ctx = new TemplateContext();
