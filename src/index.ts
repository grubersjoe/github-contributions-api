import express, { NextFunction, Request, Response } from 'express';
import bodyParser from 'body-parser';
import cache from 'memory-cache';
import cors from 'cors';

import { fetchDataForYears } from './fetch';

const app = express();

app.use(cors());
app.use(
  bodyParser.json({
    limit: '1mb',
  }),
);

app.get('/v2/:username', async (req, res, next) => {
  const { username } = req.params;
  const { format } = req.query;

  if (format !== undefined && format !== 'nested') {
    res
      .status(400)
      .send('Query parameter `format` must be `nested` or undefined');
  }

  let years: number[] | undefined;

  if (typeof req.query.y === 'string') {
    years = [parseInt(req.query.y)].filter(n => !isNaN(n));
  }

  if (Array.isArray(req.query.y)) {
    years = (req.query.y as string[])
      .map(y => parseInt(y))
      .filter(n => !isNaN(n));
  }

  try {
    const key = `${username}-${years ? years.join('-') : ''}-${format}`;
    const cached = cache.get(key);

    // if (cached !== null) {
    //   return res.json(cached);
    // }

    const data = await fetchDataForYears(
      username,
      years,
      format as 'nested' | undefined,
    );

    cache.put(key, data, 1000 * 3600); // Store for an hour

    res.json(data);
  } catch (err) {
    console.error(err);
    next(
      new Error(`Fetching profile of ${username} has failed: ${err.message}`),
    );
  }
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).send({
    error: err.message,
  });
});

app.listen(8080, () =>
  console.log('Server listening on http://localhost:8080'),
);
