import express from 'express';
import httpLogger from 'pino-http';
import {Writable} from 'node:stream';
import {Config} from '../../src/configuration';
import {initLogger} from '../../src/init-dependencies/init-dependencies';
import {serve} from '../eink/serve';

// pino-http logs each request's headers at debug, which is the level
// production runs at; bearer tokens must not come along with them.
describe('the request log', () => {
  it('records the Authorization and Cookie headers redacted', async () => {
    const lines: string[] = [];
    const sink = new Writable({
      write: (chunk: Buffer, _encoding, done) => {
        lines.push(chunk.toString());
        done();
      },
    });
    const logger = initLogger(
      {LOG_LEVEL: 'debug', PUBLIC_URL: 'https://app.example'} as Config,
      sink
    );
    const app = express();
    // As in src/index.ts. The types from pino-http are broken
    // https://github.com/pinojs/pino-http/issues/378
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
    app.use(httpLogger({logger, useLevel: 'debug'} as any));
    app.get('/', (_req, res) => {
      res.send('ok');
    });
    const server = await serve(app);
    await server.get('/', {
      authorization: 'Bearer not-for-the-logs',
      cookie: 'ms-app-session=not-for-the-logs-either',
    });
    await server.close();

    // The line is written once the response finishes, a moment after the
    // client has it.
    for (let i = 0; i < 50 && lines.length === 0; i++) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    const log = lines.join('');
    expect(log).toContain('"authorization":"[redacted]"');
    expect(log).toContain('"cookie":"[redacted]"');
    expect(log).not.toContain('not-for-the-logs');
  });
});
