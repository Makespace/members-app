import express, {Application, Request, Response} from 'express';

const app: Application = express();
const port = 8080;

app.get('/', (req: Request, res: Response) => {
  res.status(200).send(`
    <h1>Makespace Member Number Lookup</h1>
  `);
});

app.listen(port, () =>
  process.stdout.write(`Server is listening on port ${port}!\n`)
);
