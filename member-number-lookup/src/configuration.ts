export type Config = {
  port: number;
  tokenSecret: string;
  sessionSecret: string;
  useStubbedAdapters: boolean;
  sql: {
    host: string;
    database: string;
    user: string;
    password: string;
  };
  smtp: {
    host: string;
    port: number;
    user: string;
    pass: string;
  };
};

export const loadConfig = (): Config => ({
  port: parseInt(process.env.PORT ?? '8080'),
  sessionSecret: 'secret',
  tokenSecret: 'secret',
  useStubbedAdapters: process.env.USE_STUBBED_ADAPTERS === 'true',
  sql: {
    host: process.env.MYSQL_HOST ?? '',
    database: process.env.MYSQL_DATABASE ?? '',
    user: process.env.MYSQL_USER ?? '',
    password: process.env.MYSQL_PASSWORD ?? '',
  },
  smtp: {
    host: process.env.SMTP_HOST ?? '',
    port: parseInt(process.env.SMTP_PORT || '2525'),
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASSWORD ?? '',
  },
});
