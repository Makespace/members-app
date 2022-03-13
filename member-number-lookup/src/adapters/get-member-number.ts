import * as TE from 'fp-ts/TaskEither';
import {Email} from '../types';
import mysql from 'mysql';

type GetMemberNumber = (email: Email) => TE.TaskEither<string, number>;

export const getMemberNumber = (): GetMemberNumber => {
  const connection = mysql.createConnection({
    host: process.env.MYSQL_HOST,
    database: process.env.MYSQL_DATABASE,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
  });

  connection.connect(err => {
    if (err) {
      console.error('error connecting: ' + err.stack);
      return;
    }

    console.log('connected as id ' + connection.threadId);
  });

  return () => TE.left('getMemberNumber not implemented');
};
