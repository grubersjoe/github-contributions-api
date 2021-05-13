import express, { NextFunction, Request, Response } from 'express';
import bodyParser from 'body-parser';
import cache from 'memory-cache';
import cors from 'cors';

import { fetchContributionsForQuery } from './fetch';

export interface ParsedQuery {
  years: Array<number>;
  allYears: boolean;
  lastYear: boolean;
  format?: 'nested';
}

const app = express();

app.use(cors());
app.use(
  bodyParser.json({
    limit: '1mb',
  }),
);

app.get('/v4/:username', async (req, res, next) => {
  const { username } = req.params;
  const { format } = req.query;

  if (format !== undefined && format !== 'nested') {
    res
      .status(400)
      .send('Query parameter `format` must be `nested` or undefined');
  }

  const years = req.query.y
    ? typeof req.query.y === 'string'
      ? [req.query.y]
      : (req.query.y as Array<string>)
    : ['all']; // default

  const query: ParsedQuery = {
    years: years.map(y => parseInt(y)).filter(y => !isNaN(y)),
    allYears: years.includes('all'),
    lastYear: years.includes('lastYear'),
    format: format as 'nested' | undefined,
  };

  try {
    const key = `${username}-${JSON.stringify(query)}-${format}`;
    const cached = cache.get(key);

    if (cached !== null) {
      return res.json(cached);
    }

    const data = await fetchContributionsForQuery(username, query);

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

app.listen(process.env.PORT ?? 8080, () =>
  console.log(
    `Server listening on http://localhost:${process.env.PORT || 8080}`,
  ),
);
