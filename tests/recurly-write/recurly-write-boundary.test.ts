// Guards the rule that every write to Recurly goes through
// src/recurly-write/recurly-write-gateway.ts. If one of these fails, do not
// loosen it to make your change pass: route the write through the gateway
// instead, and read "Recurly writes" in AGENTS.md. Changing this file is
// itself flagged on pull requests.
import fs from 'fs';
import path from 'path';
import recurly from 'recurly';

const repoRoot = path.resolve(__dirname, '../..');
const GATEWAY_DIR = 'src/recurly-write/';
const GATEWAY = 'src/recurly-write/recurly-write-gateway.ts';
const READ_ONLY_SYNC = 'src/sync-worker/recurly/pull-recurly-data.ts';

const listFiles = (dir: string, extensions: ReadonlyArray<string>): string[] =>
  fs.readdirSync(path.join(repoRoot, dir), {withFileTypes: true}).flatMap(entry => {
    const relative = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === 'node_modules' ? [] : listFiles(relative, extensions);
    }
    return extensions.some(ext => entry.name.endsWith(ext)) ? [relative] : [];
  });

const read = (file: string) => fs.readFileSync(path.join(repoRoot, file), 'utf8');

const codeFiles = [
  ...listFiles('src', ['.ts', '.js', '.mjs']),
  ...listFiles('scripts', ['.ts', '.js', '.mjs']),
];

// Every method on the Recurly client that is not a plain read. Derived from
// the library rather than listed by hand, so methods added in a future
// version of the package are covered without anyone remembering to.
const recurlyWriteMethods = Object.getOwnPropertyNames(recurly.Client.prototype)
  .filter(name => typeof (recurly.Client.prototype as unknown as Record<string, unknown>)[name] === 'function')
  .filter(name => name !== 'constructor' && name !== 'apiVersion')
  .filter(name => !/^(list|get|show)[A-Z]/.test(name));

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

describe('recurly write boundary', () => {
  it('recognises Recurly write methods', () => {
    expect(recurlyWriteMethods).toEqual(
      expect.arrayContaining([
        'terminateSubscription',
        'cancelSubscription',
        'pauseSubscription',
        'refundInvoice',
        'deactivateAccount',
        'updateBillingInfo',
        'createPurchase',
      ])
    );
    expect(recurlyWriteMethods).not.toContain('listAccounts');
  });

  it('only imports the recurly package in the gateway and the read-only sync', () => {
    const importsRecurly = /(from\s+|require\(\s*|import\(\s*)['"]recurly(\/[^'"]*)?['"]/;
    const offenders = codeFiles
      .filter(file => file !== GATEWAY && file !== READ_ONLY_SYNC)
      .filter(file => importsRecurly.test(read(file)));
    expect(offenders).toStrictEqual([]);
  });

  it('never calls a Recurly write method outside the gateway', () => {
    // Callers reach the gateway as `deps.recurlyWrite.pauseSubscription(...)`,
    // so a write-method name called on `recurlyWrite` is the allowed way in.
    // Anything else - including a write slipped into the read-only sync - is
    // a direct call on a Recurly client.
    const offenders = codeFiles
      .filter(file => !file.startsWith(GATEWAY_DIR))
      .flatMap(file => {
        const source = read(file);
        return recurlyWriteMethods
          .filter(method =>
            new RegExp(
              `(?<!recurlyWrite)\\.${escape(method)}\\s*\\(|\\[\\s*['"\`]${escape(method)}['"\`]\\s*\\]`
            ).test(source)
          )
          .map(method => `${file}: ${method}`);
      });
    expect(offenders).toStrictEqual([]);
  });

  it('only reads the write token where the gateway is wired up', () => {
    const allowed = ['src/configuration.ts', 'src/init-dependencies/init-dependencies.ts'];
    const offenders = codeFiles
      .filter(file => !file.startsWith(GATEWAY_DIR) && !allowed.includes(file))
      .filter(file => read(file).includes('RECURLY_WRITE_TOKEN'));
    expect(offenders).toStrictEqual([]);
  });

  it('never calls the Recurly HTTP API directly', () => {
    const offenders = [...codeFiles, ...listFiles('scripts', ['.sh'])]
      .filter(file => !file.startsWith(GATEWAY_DIR))
      .filter(file => /v3(\.eu)?\.recurly\.com/.test(read(file)));
    expect(offenders).toStrictEqual([]);
  });
});
